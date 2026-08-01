defmodule ChainIQ.Schema.Category do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}

  schema "categories" do
    field(:category_l1, :string)
    field(:category_l2, :string)
    field(:description, :string)
    field(:typical_unit, :string)
    field(:pricing_model, :string)

    timestamps(type: :utc_datetime)
  end

  @required ~w(category_l1 category_l2)a
  @optional ~w(description typical_unit pricing_model)a

  def changeset(category, attrs) do
    category
    |> cast(attrs, @required ++ @optional)
    |> validate_required(@required)
    |> unique_constraint([:category_l1, :category_l2])
  end
end
