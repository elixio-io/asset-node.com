defmodule ChainIQ.Schema.Supplier do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}

  schema "suppliers" do
    field(:supplier_id, :string)
    field(:name, :string)
    field(:category_l1, :string)
    field(:category_l2, :string)
    field(:country_hq, :string)
    field(:service_regions, {:array, :string}, default: [])
    field(:currency, :string)
    field(:pricing_model, :string)
    field(:quality_score, :float)
    field(:risk_score, :float)
    field(:esg_score, :float)
    field(:preferred, :boolean, default: false)
    field(:restricted, :boolean, default: false)
    field(:restriction_reason, :string)
    field(:contract_status, :string)
    field(:data_residency_supported, :boolean, default: false)
    field(:capacity_per_month, :integer)
    field(:notes, :string)

    has_many(:pricing_entries, ChainIQ.Schema.PricingEntry,
      foreign_key: :supplier_id,
      references: :supplier_id
    )

    timestamps(type: :utc_datetime)
  end

  @required ~w(supplier_id name category_l1 category_l2 country_hq currency contract_status)a
  @optional ~w(service_regions pricing_model quality_score risk_score esg_score preferred restricted restriction_reason data_residency_supported capacity_per_month notes)a

  def changeset(supplier, attrs) do
    supplier
    |> cast(attrs, @required ++ @optional)
    |> validate_required(@required)
    |> unique_constraint(:supplier_id)
  end
end
