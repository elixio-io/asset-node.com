defmodule ChainIQ.Engine.PolicyEngine do
  alias ChainIQ.Data.Policies

  def evaluate(request) do
    results = %{
      approval: check_approval_threshold(request),
      restricted: check_restricted_suppliers(request),
      category: check_category_rules(request),
      geography: check_geography_rules(request),
      preferred: check_preferred_supplier(request)
    }

    violations =
      results
      |> Enum.flat_map(fn {_type, checks} -> Enum.filter(checks, & &1.violated) end)

    approval_level =
      results.approval
      |> Enum.filter(& &1.triggered)
      |> Enum.max_by(fn a -> a.threshold_value end, fn -> nil end)

    {results, violations, approval_level}
  end

  def check_approval_threshold(request) do
    budget = request["budget_amount"] || 0
    currency = request["currency"] || "EUR"

    Policies.approval_thresholds()
    |> Enum.map(fn threshold ->
      threshold_currency = threshold["currency"]

      min_amount =
        threshold["min_amount"] || threshold["min_value"] || threshold["amount"] ||
          threshold["threshold"] || 0

      max_amount = threshold["max_amount"] || threshold["max_value"]

      threshold_value = min_amount

      triggered =
        threshold_currency == currency and
          budget >= min_amount and
          (max_amount == nil or budget <= max_amount)

      approver =
        threshold["deviation_approval_required_from"] ||
          threshold["approvers"] ||
          threshold["approver"] ||
          threshold["approval_level"]

      approver_str =
        case approver do
          list when is_list(list) and length(list) > 0 -> Enum.join(list, ", ")
          str when is_binary(str) -> str
          _ -> threshold["managed_by"] |> List.wrap() |> Enum.join(", ")
        end

      %{
        rule_id: threshold["threshold_id"] || threshold["rule_id"] || threshold["level"],
        threshold_value: threshold_value,
        threshold_currency: threshold_currency,
        request_amount: budget,
        request_currency: currency,
        triggered: triggered,
        violated: false,
        approver: approver_str,
        min_quotes: threshold["min_supplier_quotes"] || threshold["quotes_required"] || 1,
        description:
          threshold["description"] || threshold["policy_note"] ||
            "Approval tier #{threshold["threshold_id"]}: #{min_amount}–#{max_amount || "∞"} #{threshold_currency}"
      }
    end)
  end

  def check_restricted_suppliers(request) do
    mentioned = request["preferred_supplier_mentioned"]
    country = request["country"]
    budget = request["budget_amount"] || 0

    Policies.restricted_suppliers()
    |> Enum.map(fn rule ->
      supplier_id = rule["supplier_id"]
      restriction = rule["restriction_type"] || rule["restriction"]

      country_restricted =
        case rule["restricted_countries"] do
          countries when is_list(countries) -> country in countries
          _ -> false
        end

      value_restricted =
        case rule["max_value"] do
          max when is_number(max) -> budget > max
          _ -> false
        end

      generally_restricted = rule["is_restricted"] == true

      violated = generally_restricted or country_restricted or value_restricted

      matches_mentioned =
        mentioned &&
          String.contains?(to_string(mentioned), to_string(rule["supplier_name"] || ""))

      %{
        rule_id: rule["rule_id"] || supplier_id,
        supplier_id: supplier_id,
        supplier_name: rule["supplier_name"],
        restriction_type: restriction,
        restriction_reason: rule["reason"] || rule["restriction_reason"],
        violated: violated and matches_mentioned,
        country_restricted: country_restricted,
        value_restricted: value_restricted,
        triggered: violated
      }
    end)
  end

  def check_category_rules(request) do
    category_l1 = request["category_l1"]
    category_l2 = request["category_l2"]

    Policies.category_rules()
    |> Enum.filter(fn rule ->
      (rule["category_l1"] == category_l1 or rule["category_l1"] == "*") and
        (rule["category_l2"] == category_l2 or rule["category_l2"] == "*" or
           rule["category_l2"] == nil)
    end)
    |> Enum.map(fn rule ->
      %{
        rule_id: rule["rule_id"],
        category: "#{category_l1}/#{category_l2}",
        rule_type: rule["rule_type"],
        description: rule["description"],
        requirement: rule["requirement"],
        violated: check_category_violation(rule, request),
        triggered: true
      }
    end)
  end

  defp check_category_violation(rule, request) do
    budget = request["budget_amount"] || 0
    quantity = request["quantity"] || 0
    currency = request["currency"] || "EUR"

    case rule["rule_type"] do
      "mandatory_comparison" ->
        currency in ["EUR", "CHF"] and budget > 100_000

      "engineering_spec_review" ->
        quantity > 50

      "fast_track" ->
        not (currency in ["EUR", "CHF"] and budget < 75_000)

      "residency_check" ->
        request["data_residency_constraint"] == true or
          request["data_residency"] == true

      "security_review" ->
        currency in ["EUR", "CHF"] and budget > 250_000

      "design_signoff" ->
        true

      "cv_review" ->
        quantity > 60

      "certification_check" ->
        true

      "performance_baseline" ->
        true

      "brand_safety" ->
        true

      "approval_required" ->
        true

      _ ->
        false
    end
  end

  def check_geography_rules(request) do
    country = request["country"]
    delivery = request["delivery_countries"] || [country]

    Policies.geography_rules()
    |> Enum.filter(fn rule ->
      rule_countries = rule["countries"] || rule["applicable_countries"] || []
      Enum.any?(delivery, fn c -> c in rule_countries end) or country in rule_countries
    end)
    |> Enum.map(fn rule ->
      %{
        rule_id: rule["rule_id"],
        countries: rule["countries"] || rule["applicable_countries"],
        rule_type: rule["rule_type"],
        description: rule["description"],
        requirement: rule["requirement"],
        data_residency: rule["data_residency_required"] || false,
        violated: check_geography_violation(rule, request),
        triggered: true
      }
    end)
  end

  defp check_geography_violation(rule, request) do
    case rule["data_residency_required"] do
      true -> request["data_residency_constraint"] == true
      _ -> false
    end
  end

  def check_preferred_supplier(request) do
    mentioned = request["preferred_supplier_mentioned"]
    category_l1 = request["category_l1"]
    preferred = Policies.preferred_suppliers()

    preferred_list =
      case preferred do
        %{"categories" => cats} -> cats[category_l1] || []
        list when is_list(list) -> list
        _ -> []
      end

    [
      %{
        mentioned_supplier: mentioned,
        category: category_l1,
        is_preferred: mentioned in preferred_list or mentioned == nil,
        violated: mentioned != nil and mentioned not in preferred_list and preferred_list != [],
        triggered: mentioned != nil
      }
    ]
  end
end
