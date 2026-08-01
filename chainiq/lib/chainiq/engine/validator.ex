defmodule ChainIQ.Engine.Validator do
  alias ChainIQ.Data.{Categories, Suppliers}

  def validate(request) do
    [
      check_missing_fields(request),
      check_budget_vs_estimate(request),
      check_quantity_consistency(request),
      check_category_exists(request),
      check_supplier_in_category(request),
      check_supplier_region(request),
      check_delivery_date(request),
      check_currency_consistency(request)
    ]
    |> List.flatten()
    |> Enum.reject(&is_nil/1)
  end

  defp check_missing_fields(request) do
    critical = [
      {"quantity", "Quantity is missing — cannot calculate total cost or verify capacity"},
      {"budget_amount",
       "Budget amount is missing — cannot evaluate approval thresholds or budget fit"},
      {"category_l1", "Primary category (L1) is missing — cannot match suppliers"},
      {"category_l2", "Secondary category (L2) is missing — cannot match suppliers precisely"},
      {"country", "Country is missing — cannot apply geography or regulatory rules"},
      {"currency", "Currency is missing — cannot compare prices or evaluate thresholds"}
    ]

    Enum.flat_map(critical, fn {field, message} ->
      if request[field] == nil do
        [
          %{
            type: "missing_field",
            severity: "warning",
            message: message,
            field: field
          }
        ]
      else
        []
      end
    end)
  end

  defp check_budget_vs_estimate(request) do
    budget = request["budget_amount"]
    qty = request["quantity"] || 1

    if budget && budget > 0 && qty > 0 do
      per_unit = budget / qty

      if per_unit < 1 or per_unit > 100_000 do
        %{
          type: "budget_anomaly",
          severity: "warning",
          message:
            "Budget per unit (#{per_unit |> Float.round(2)}) appears unusual for quantity #{qty}",
          field: "budget_amount"
        }
      end
    end
  end

  defp check_quantity_consistency(request) do
    qty_field = request["quantity"]
    text = request["request_text"] || ""

    numbers =
      Regex.scan(~r/\b(\d{1,6})\b/, text)
      |> Enum.map(fn [_, n] -> String.to_integer(n) end)
      |> Enum.filter(fn n -> n > 0 and n != qty_field end)

    if qty_field && length(numbers) > 0 do
      mismatches =
        Enum.filter(numbers, fn n ->
          n > 1 and n < 100_000 and n != qty_field and
            abs(n - qty_field) > qty_field * 0.1
        end)

      if length(mismatches) > 0 do
        %{
          type: "quantity_mismatch",
          severity: "warning",
          message:
            "Quantity field (#{qty_field}) may not match text mentions: #{inspect(mismatches)}",
          field: "quantity"
        }
      end
    end
  end

  defp check_category_exists(request) do
    l1 = request["category_l1"]
    l2 = request["category_l2"]

    if l1 && l2 && !Categories.valid?(l1, l2) do
      %{
        type: "invalid_category",
        severity: "error",
        message: "Category #{l1}/#{l2} not found in category master data",
        field: "category"
      }
    end
  end

  defp check_supplier_in_category(request) do
    mentioned = request["preferred_supplier_mentioned"]
    l1 = request["category_l1"]
    l2 = request["category_l2"]

    if mentioned && l1 && l2 do
      suppliers_in_cat = Suppliers.by_category(l1, l2)

      match =
        Enum.find(suppliers_in_cat, fn s ->
          String.contains?(String.downcase(s.name), String.downcase(mentioned))
        end)

      unless match do
        %{
          type: "supplier_category_mismatch",
          severity: "warning",
          message: "Preferred supplier '#{mentioned}' not found in category #{l1}/#{l2}",
          field: "preferred_supplier"
        }
      end
    end
  end

  defp check_delivery_date(request) do
    required_by = request["required_by_date"]

    if required_by do
      case Date.from_iso8601(required_by) do
        {:ok, date} ->
          days = Date.diff(date, Date.utc_today())

          cond do
            days < 0 ->
              %{
                type: "past_delivery_date",
                severity: "error",
                message: "Required-by date #{required_by} is in the past",
                field: "required_by_date"
              }

            days < 7 ->
              %{
                type: "urgent_delivery",
                severity: "warning",
                message: "Required-by date is #{days} days away — may be unrealistic",
                field: "required_by_date"
              }

            true ->
              nil
          end

        _ ->
          nil
      end
    end
  end

  defp check_currency_consistency(request) do
    currency = request["currency"]
    country = request["country"]

    expected = %{
      "DE" => "EUR",
      "FR" => "EUR",
      "NL" => "EUR",
      "BE" => "EUR",
      "AT" => "EUR",
      "IT" => "EUR",
      "ES" => "EUR",
      "CH" => "CHF",
      "GB" => "GBP",
      "UK" => "GBP",
      "US" => "USD",
      "JP" => "JPY",
      "BR" => "BRL"
    }

    expected_cur = expected[country]

    if currency && expected_cur && currency != expected_cur do
      %{
        type: "currency_country_mismatch",
        severity: "info",
        message: "Currency #{currency} unusual for country #{country} (expected #{expected_cur})",
        field: "currency"
      }
    end
  end

  defp check_supplier_region(request) do
    mentioned = request["preferred_supplier_mentioned"]
    delivery = request["delivery_countries"] || [request["country"]]

    if mentioned && delivery != [] do
      all_suppliers = Suppliers.all()

      matching =
        Enum.filter(all_suppliers, fn s ->
          String.contains?(String.downcase(to_string(s.name)), String.downcase(mentioned))
        end)

      if length(matching) > 0 do
        serves_region =
          Enum.any?(matching, fn s ->
            regions =
              if is_list(s.service_regions),
                do: s.service_regions,
                else: String.split(to_string(s.service_regions || ""), ";")

            Enum.all?(delivery, fn c -> c in regions end)
          end)

        unless serves_region do
          %{
            type: "supplier_region_mismatch",
            severity: "warning",
            message:
              "Preferred supplier '#{mentioned}' does not serve delivery " <>
                "countries #{inspect(delivery)}",
            field: "preferred_supplier"
          }
        end
      end
    end
  end
end
