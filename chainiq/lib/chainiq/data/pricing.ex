defmodule ChainIQ.Data.Pricing do
  import Ecto.Query
  alias ChainIQ.Repo
  alias ChainIQ.Schema.PricingEntry

  def all do
    Repo.all(PricingEntry)
  end

  def for_supplier(supplier_id, category_l2) do
    Repo.all(
      from(p in PricingEntry,
        where: p.supplier_id == ^supplier_id and p.category_l2 == ^category_l2,
        order_by: [asc: p.min_quantity]
      )
    )
  end

  def resolve_tier(supplier_id, category_l2, quantity) do
    tiers = for_supplier(supplier_id, category_l2)

    tier =
      Enum.find(tiers, fn t ->
        quantity >= (t.min_quantity || 0) and
          (t.max_quantity == nil or quantity <= t.max_quantity)
      end)

    case tier do
      nil ->
        highest = List.last(tiers)
        if highest, do: {:ok, highest}, else: {:error, :no_pricing}

      tier ->
        {:ok, tier}
    end
  end

  def calculate_total(supplier_id, category_l2, quantity, expedited? \\ false) do
    case resolve_tier(supplier_id, category_l2, quantity) do
      {:ok, tier} ->
        price =
          if expedited?, do: tier.expedited_unit_price || tier.unit_price, else: tier.unit_price

        lead =
          if expedited?, do: tier.expedited_lead_time_days, else: tier.standard_lead_time_days

        {:ok,
         %{
           unit_price: price,
           total: price * quantity,
           lead_time_days: lead,
           tier: "#{tier.min_quantity}-#{tier.max_quantity || "∞"}",
           pricing_id: tier.pricing_id,
           moq: tier.moq
         }}

      {:error, reason} ->
        {:error, reason}
    end
  end
end
