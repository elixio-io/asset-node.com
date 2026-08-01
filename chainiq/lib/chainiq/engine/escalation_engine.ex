defmodule ChainIQ.Engine.EscalationEngine do
  alias ChainIQ.Data.Policies

  def evaluate(request, policy_results, supplier_results) do
    rules = Policies.escalation_rules()

    triggered =
      rules
      |> Enum.map(fn rule -> check_rule(rule, request, policy_results, supplier_results) end)
      |> Enum.filter(& &1.triggered)

    %{
      escalation_required: length(triggered) > 0,
      triggered_rules: triggered,
      escalation_targets: triggered |> Enum.map(& &1.escalate_to) |> Enum.uniq(),
      urgency: determine_urgency(triggered)
    }
  end

  defp check_rule(rule, request, policy_results, supplier_results) do
    rule_id = rule["rule_id"] || rule["id"]
    trigger_type = rule["trigger"] || rule["trigger_type"] || rule["condition"]

    triggered =
      case trigger_type do
        "missing_required_information" ->
          request["quantity"] == nil or
            request["budget_amount"] == nil or
            request["category_l1"] == nil

        "preferred_supplier_restricted" ->
          check_preferred_restricted(request, policy_results)

        "value_exceeds_threshold" ->
          check_value_exceeds_threshold(policy_results)

        "no_compliant_supplier_found" ->
          check_no_compliant_suppliers(supplier_results)

        "data_residency_constraint_conflict" ->
          check_data_residency_conflict(request, supplier_results)

        "single_supplier_capacity_risk" ->
          check_capacity_risk(request, supplier_results)

        "brand_safety_review_needed" ->
          check_brand_safety(request)

        "budget_exceeded" ->
          check_value_exceeds_threshold(policy_results)

        "no_compliant_suppliers" ->
          check_no_compliant_suppliers(supplier_results)

        "restricted_supplier_requested" ->
          check_preferred_restricted(request, policy_results)

        "capacity_exceeded" ->
          check_capacity_risk(request, supplier_results)

        "lead_time_exceeded" ->
          check_lead_time_exceeded(request, supplier_results)

        "policy_override_requested" ->
          check_policy_override(request)

        "conflicting_requirements" ->
          check_conflicting(request, policy_results)

        other when is_binary(other) ->
          cond do
            String.contains?(other, "not registered") or String.contains?(other, "sanction") ->
              check_supplier_not_registered(request, supplier_results)

            true ->
              false
          end

        _ ->
          false
      end

    %{
      rule_id: rule_id,
      trigger_type: trigger_type,
      triggered: triggered,
      description: rule["description"] || rule["name"],
      escalate_to: rule["escalate_to"] || rule["target"] || rule["escalation_target"],
      severity: rule["severity"] || "medium",
      action_required: rule["action"] || rule["action_required"]
    }
  end

  defp check_preferred_restricted(request, policy_results) do
    mentioned = request["preferred_supplier_mentioned"]

    if mentioned do
      case policy_results do
        {results, _violations, _approval} ->
          results.restricted |> Enum.any?(& &1.violated)

        _ ->
          false
      end
    else
      false
    end
  end

  defp check_value_exceeds_threshold(policy_results) do
    case policy_results do
      {results, _violations, approval} ->
        case approval do
          %{threshold_value: v} when is_number(v) ->
            v >= 500_000

          _ ->
            results.approval
            |> Enum.any?(fn a -> a.triggered and a.threshold_value >= 500_000 end)
        end

      _ ->
        false
    end
  end

  defp check_no_compliant_suppliers(supplier_results) do
    case supplier_results do
      %{included: included} -> length(included) == 0
      list when is_list(list) -> length(list) == 0
      _ -> false
    end
  end

  defp check_data_residency_conflict(request, supplier_results) do
    has_constraint = request["data_residency_constraint"] == true
    country = request["country"]

    if has_constraint do
      case supplier_results do
        %{included: suppliers} ->
          not Enum.any?(suppliers, fn s ->
            regions = Map.get(s, :service_regions) || Map.get(s, "service_regions") || []

            regions =
              if is_binary(regions),
                do: String.split(regions, ";", trim: true),
                else: List.wrap(regions)

            country in regions
          end)

        _ ->
          true
      end
    else
      false
    end
  end

  defp check_capacity_risk(request, supplier_results) do
    qty = request["quantity"] || 0

    case supplier_results do
      %{included: suppliers} when qty > 0 ->
        Enum.all?(suppliers, fn s ->
          cap = Map.get(s, :capacity_per_month) || 999_999
          cap < qty
        end)

      _ ->
        false
    end
  end

  defp check_brand_safety(request) do
    cat_l1 = request["category_l1"] || ""
    cat_l2 = request["category_l2"] || ""

    String.downcase(cat_l1) == "marketing" and
      String.contains?(String.downcase(cat_l2), ["influencer", "social", "creator"])
  end

  defp check_supplier_not_registered(request, supplier_results) do
    delivery_countries = request["delivery_countries"] || [request["country"]]

    case supplier_results do
      %{included: suppliers} when is_list(suppliers) and suppliers != [] ->
        Enum.all?(suppliers, fn s ->
          regions = Map.get(s, :service_regions) || Map.get(s, "service_regions") || []

          regions =
            if is_binary(regions),
              do: String.split(regions, ";", trim: true),
              else: List.wrap(regions)

          not Enum.any?(delivery_countries, fn c -> c in regions end)
        end)

      _ ->
        false
    end
  end

  defp check_lead_time_exceeded(request, supplier_results) do
    required_by = request["required_by_date"]

    case {required_by, supplier_results} do
      {nil, _} ->
        false

      {_, %{pricing: pricing}} ->
        Enum.all?(pricing, fn p ->
          p.lead_time_days != nil and p.lead_time_days > days_until(required_by)
        end)

      _ ->
        false
    end
  end

  defp check_policy_override(request) do
    text = request["request_text"] || ""
    String.contains?(String.downcase(text), ["override", "exception", "waiver", "bypass"])
  end

  defp check_conflicting(_request, policy_results) do
    case policy_results do
      {_results, violations, _approval} -> length(violations) >= 2
      _ -> false
    end
  end

  defp determine_urgency(triggered_rules) do
    severities = Enum.map(triggered_rules, & &1.severity)

    cond do
      "critical" in severities -> "critical"
      "high" in severities -> "high"
      "medium" in severities -> "medium"
      true -> "low"
    end
  end

  defp days_until(date_string) do
    case Date.from_iso8601(date_string) do
      {:ok, date} -> Date.diff(date, Date.utc_today())
      _ -> 999
    end
  end
end
