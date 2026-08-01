defmodule ChainIQ.Engine.SupplierMatcher do
  alias ChainIQ.Data.{Suppliers, Pricing}

  def match(request) do
    category_l1 = request["category_l1"]
    category_l2 = request["category_l2"]
    country = request["country"]
    quantity = request["quantity"] || 1
    delivery_countries = request["delivery_countries"] || [country]

    primary_region = List.first(delivery_countries) || country

    {included, excluded} = Suppliers.filter_with_reasons(category_l1, category_l2, primary_region)

    pricing =
      Enum.map(included, fn supplier ->
        case Pricing.calculate_total(supplier.supplier_id, category_l2, quantity) do
          {:ok, price_info} ->
            Map.merge(price_info, %{
              supplier_id: supplier.supplier_id,
              supplier_name: supplier.name,
              quality_score: supplier.quality_score,
              risk_score: supplier.risk_score,
              esg_score: supplier.esg_score,
              preferred: supplier.preferred
            })

          {:error, _} ->
            %{
              supplier_id: supplier.supplier_id,
              supplier_name: supplier.name,
              unit_price: nil,
              total: nil,
              lead_time_days: nil,
              quality_score: supplier.quality_score,
              risk_score: supplier.risk_score,
              esg_score: supplier.esg_score,
              preferred: supplier.preferred,
              error: "no_pricing_available"
            }
        end
      end)

    %{
      included: included,
      excluded: excluded,
      pricing: pricing,
      category: "#{category_l1}/#{category_l2}",
      region: primary_region,
      quantity: quantity
    }
  end
end
