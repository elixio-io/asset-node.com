defmodule ChainIQ.Schema.PricingEntry do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}

  schema "pricing_entries" do
    field(:pricing_id, :string)
    field(:supplier_id, :string)
    field(:category_l1, :string)
    field(:category_l2, :string)
    field(:region, :string)
    field(:currency, :string)
    field(:pricing_model, :string)
    field(:min_quantity, :integer)
    field(:max_quantity, :integer)
    field(:unit_price, :float)
    field(:moq, :integer)
    field(:standard_lead_time_days, :integer)
    field(:expedited_lead_time_days, :integer)
    field(:expedited_unit_price, :float)
    field(:valid_from, :string)
    field(:valid_to, :string)
    field(:notes, :string)

    timestamps(type: :utc_datetime)
  end

  @required ~w(pricing_id supplier_id category_l1 category_l2 region currency)a
  @optional ~w(pricing_model min_quantity max_quantity unit_price moq standard_lead_time_days expedited_lead_time_days expedited_unit_price valid_from valid_to notes)a

  def changeset(entry, attrs) do
    entry
    |> cast(attrs, @required ++ @optional)
    |> validate_required(@required)
    |> unique_constraint(:pricing_id)
  end
end
