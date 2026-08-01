


alias ChainIQ.Repo

alias ChainIQ.Schema.{
  Supplier,
  PricingEntry,
  Category,
  ProcurementRequest,
  PolicySet,
  HistoricalAward
}

NimbleCSV.define(SeedCSV, separator: ",", escape: "\"")

data_dir = :code.priv_dir(:chainiq) |> Path.join("data")

now = DateTime.utc_now() |> DateTime.truncate(:second)

IO.puts("🌱 Seeding ChainIQ database from #{data_dir}...")


defmodule SeedHelper do
  def parse_csv(path) do
    [headers | rows] =
      path
      |> File.read!()
      |> String.split("\n")
      |> Enum.reject(&(&1 == ""))

    header_list = String.split(headers, ",")

    Enum.map(rows, fn row ->

      values =
        row
        |> SeedCSV.parse_string(skip_headers: false)
        |> List.first()

      if values && length(values) == length(header_list) do
        Enum.zip(header_list, values) |> Map.new()
      else
        nil
      end
    end)
    |> Enum.reject(&is_nil/1)
  end

  def to_float(nil), do: nil
  def to_float(""), do: nil
  def to_float(v) when is_float(v), do: v
  def to_float(v) when is_integer(v), do: v / 1

  def to_float(v) when is_binary(v) do
    case Float.parse(v) do
      {f, _} -> f
      :error -> nil
    end
  end

  def to_int(nil), do: nil
  def to_int(""), do: nil
  def to_int(v) when is_integer(v), do: v

  def to_int(v) when is_binary(v) do
    case Integer.parse(v) do
      {i, _} -> i
      :error -> nil
    end
  end

  def to_bool(nil), do: false
  def to_bool(""), do: false
  def to_bool("TRUE"), do: true
  def to_bool("True"), do: true
  def to_bool("true"), do: true
  def to_bool("yes"), do: true
  def to_bool("Yes"), do: true
  def to_bool("1"), do: true
  def to_bool(true), do: true
  def to_bool(_), do: false

  def parse_regions(nil), do: []
  def parse_regions(""), do: []

  def parse_regions(v) when is_binary(v) do
    v
    |> String.replace(~r/[\[\]"]/, "")
    |> String.split(~r/[;,]/)
    |> Enum.map(&String.trim/1)
    |> Enum.reject(&(&1 == ""))
  end
end


IO.write("  Suppliers... ")
suppliers_path = Path.join(data_dir, "suppliers.csv")
supplier_rows = SeedHelper.parse_csv(suppliers_path)

Enum.each(supplier_rows, fn row ->
  attrs = %{
    supplier_id: row["supplier_id"],
    name: row["supplier_name"],
    category_l1: row["category_l1"],
    category_l2: row["category_l2"],
    country_hq: row["country_hq"],
    service_regions: SeedHelper.parse_regions(row["service_regions"]),
    currency: row["currency"],
    pricing_model: row["pricing_model"],
    quality_score: SeedHelper.to_float(row["quality_score"]),
    risk_score: SeedHelper.to_float(row["risk_score"]),
    esg_score: SeedHelper.to_float(row["esg_score"]),
    preferred: SeedHelper.to_bool(row["preferred_supplier"]),
    restricted: SeedHelper.to_bool(row["is_restricted"]),
    restriction_reason: row["restriction_reason"],
    contract_status: row["contract_status"],
    data_residency_supported: SeedHelper.to_bool(row["data_residency_supported"]),
    capacity_per_month: SeedHelper.to_int(row["capacity_per_month"]),
    notes: row["notes"]
  }

  %Supplier{}
  |> Supplier.changeset(attrs)
  |> Repo.insert!(on_conflict: :nothing)
end)

IO.puts("#{length(supplier_rows)} rows ✅")


IO.write("  Pricing entries... ")
pricing_path = Path.join(data_dir, "pricing.csv")
pricing_rows = SeedHelper.parse_csv(pricing_path)

Enum.each(pricing_rows, fn row ->
  attrs = %{
    pricing_id: row["pricing_id"],
    supplier_id: row["supplier_id"],
    category_l1: row["category_l1"],
    category_l2: row["category_l2"],
    region: row["region"],
    currency: row["currency"],
    pricing_model: row["pricing_model"],
    min_quantity: SeedHelper.to_int(row["min_quantity"]),
    max_quantity: SeedHelper.to_int(row["max_quantity"]),
    unit_price: SeedHelper.to_float(row["unit_price"]),
    moq: SeedHelper.to_int(row["moq"]),
    standard_lead_time_days: SeedHelper.to_int(row["standard_lead_time_days"]),
    expedited_lead_time_days: SeedHelper.to_int(row["expedited_lead_time_days"]),
    expedited_unit_price: SeedHelper.to_float(row["expedited_unit_price"]),
    valid_from: row["valid_from"],
    valid_to: row["valid_to"],
    notes: row["notes"]
  }

  %PricingEntry{}
  |> PricingEntry.changeset(attrs)
  |> Repo.insert!(on_conflict: :nothing)
end)

IO.puts("#{length(pricing_rows)} rows ✅")


IO.write("  Categories... ")
categories_path = Path.join(data_dir, "categories.csv")
cat_rows = SeedHelper.parse_csv(categories_path)

Enum.each(cat_rows, fn row ->
  attrs = %{
    category_l1: row["category_l1"],
    category_l2: row["category_l2"],
    description: row["category_description"],
    typical_unit: row["typical_unit"],
    pricing_model: row["pricing_model"]
  }

  %Category{}
  |> Category.changeset(attrs)
  |> Repo.insert!(on_conflict: :nothing)
end)

IO.puts("#{length(cat_rows)} rows ✅")


IO.write("  Historical awards... ")
historical_path = Path.join(data_dir, "historical_awards.csv")
award_rows = SeedHelper.parse_csv(historical_path)

Enum.each(award_rows, fn row ->
  attrs = %{
    award_id: row["award_id"],
    request_id: row["request_id"],
    award_date: row["award_date"],
    category_l1: row["category_l1"],
    category_l2: row["category_l2"],
    country: row["country"],
    business_unit: row["business_unit"],
    supplier_id: row["supplier_id"],
    supplier_name: row["supplier_name"],
    total_value: SeedHelper.to_float(row["total_value"]),
    currency: row["currency"],
    quantity: SeedHelper.to_float(row["quantity"]),
    required_by_date: row["required_by_date"],
    awarded: SeedHelper.to_bool(row["awarded"]),
    award_rank: SeedHelper.to_int(row["award_rank"]),
    decision_rationale: row["decision_rationale"],
    policy_compliant: SeedHelper.to_bool(row["policy_compliant"]),
    preferred_supplier_used: SeedHelper.to_bool(row["preferred_supplier_used"]),
    escalation_required: SeedHelper.to_bool(row["escalation_required"]),
    escalated_to: row["escalated_to"],
    savings_pct: SeedHelper.to_float(row["savings_pct"]),
    lead_time_days: SeedHelper.to_int(row["lead_time_days"]),
    risk_score_at_award: SeedHelper.to_float(row["risk_score_at_award"]),
    notes: row["notes"]
  }

  %HistoricalAward{}
  |> HistoricalAward.changeset(attrs)
  |> Repo.insert!(on_conflict: :nothing)
end)

IO.puts("#{length(award_rows)} rows ✅")


IO.write("  Procurement requests... ")
requests_path = Path.join(data_dir, "requests.json")
requests = requests_path |> File.read!() |> Jason.decode!()
request_list = if is_map(requests), do: Map.get(requests, "requests", [requests]), else: requests

Enum.each(request_list, fn req ->
  attrs = %{
    request_id: req["request_id"],
    title: req["title"],
    category_l1: req["category_l1"],
    category_l2: req["category_l2"],
    country: req["country"],
    business_unit: req["business_unit"],
    currency: req["currency"],
    budget_amount: SeedHelper.to_float(req["budget_amount"]),
    quantity: SeedHelper.to_float(req["quantity"]),
    required_by_date: req["required_by_date"],
    status: "pending",
    raw_data: req
  }

  %ProcurementRequest{}
  |> ProcurementRequest.changeset(attrs)
  |> Repo.insert!(on_conflict: :nothing)
end)

IO.puts("#{length(request_list)} rows ✅")


IO.write("  Policies... ")
policies_path = Path.join(data_dir, "policies.json")
policies_data = policies_path |> File.read!() |> Jason.decode!()

%PolicySet{}
|> PolicySet.changeset(%{version: "1.0", name: "default", data: policies_data, active: true})
|> Repo.insert!(on_conflict: :nothing)

IO.puts("1 policy set ✅")


IO.puts("")
IO.puts("✅ Seeding complete!")
IO.puts("   Suppliers:    #{Repo.aggregate(Supplier, :count)}")
IO.puts("   Pricing:      #{Repo.aggregate(PricingEntry, :count)}")
IO.puts("   Categories:   #{Repo.aggregate(Category, :count)}")
IO.puts("   Historical:   #{Repo.aggregate(HistoricalAward, :count)}")
IO.puts("   Requests:     #{Repo.aggregate(ProcurementRequest, :count)}")
IO.puts("   Policy Sets:  #{Repo.aggregate(PolicySet, :count)}")
