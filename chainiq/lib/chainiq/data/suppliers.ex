defmodule ChainIQ.Data.Suppliers do
  import Ecto.Query
  alias ChainIQ.Repo
  alias ChainIQ.Schema.Supplier

  def all do
    Repo.all(Supplier)
  end

  def by_id(supplier_id) do
    Repo.all(from(s in Supplier, where: s.supplier_id == ^supplier_id))
  end

  def by_category(category_l1, category_l2) do
    Repo.all(
      from(s in Supplier,
        where: s.category_l1 == ^category_l1 and s.category_l2 == ^category_l2
      )
    )
  end

  def by_region(suppliers, region) when is_list(suppliers) do
    Enum.filter(suppliers, fn s -> region in s.service_regions end)
  end

  def active(suppliers) when is_list(suppliers) do
    Enum.filter(suppliers, fn s -> s.contract_status == "active" end)
  end

  def unrestricted(suppliers) when is_list(suppliers) do
    Enum.reject(suppliers, fn s -> s.restricted end)
  end

  def preferred(suppliers) when is_list(suppliers) do
    Enum.filter(suppliers, fn s -> s.preferred end)
  end

  def filter_pipeline(category_l1, category_l2, region) do
    by_category(category_l1, category_l2)
    |> active()
    |> by_region(region)
  end

  def filter_with_reasons(category_l1, category_l2, region) do
    all_in_category = by_category(category_l1, category_l2)

    {included, excluded} =
      Enum.reduce(all_in_category, {[], []}, fn supplier, {inc, exc} ->
        cond do
          supplier.contract_status != "active" ->
            {inc, [{supplier, "inactive contract"} | exc]}

          region not in supplier.service_regions ->
            {inc, [{supplier, "does not serve region #{region}"} | exc]}

          supplier.restricted ->
            {inc, [{supplier, "restricted: #{supplier.restriction_reason}"} | exc]}

          true ->
            {[supplier | inc], exc}
        end
      end)

    {Enum.reverse(included), Enum.reverse(excluded)}
  end
end
