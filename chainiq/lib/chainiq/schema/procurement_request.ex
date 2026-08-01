defmodule ChainIQ.Schema.ProcurementRequest do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}

  schema "procurement_requests" do
    field(:request_id, :string)
    field(:title, :string)
    field(:category_l1, :string)
    field(:category_l2, :string)
    field(:country, :string)
    field(:business_unit, :string)
    field(:currency, :string)
    field(:budget_amount, :float)
    field(:quantity, :float)
    field(:required_by_date, :string)
    field(:status, :string, default: "pending")
    field(:raw_data, :map)

    timestamps(type: :utc_datetime)
  end

  @required ~w(request_id raw_data)a
  @optional ~w(title category_l1 category_l2 country business_unit currency budget_amount quantity required_by_date status)a

  def changeset(request, attrs) do
    request
    |> cast(attrs, @required ++ @optional)
    |> validate_required(@required)
    |> unique_constraint(:request_id)
  end
end
