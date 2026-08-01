defmodule ChainIQ.Schema.PolicySet do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}

  schema "policy_sets" do
    field(:version, :string, default: "1.0")
    field(:name, :string, default: "default")
    field(:data, :map)
    field(:active, :boolean, default: true)

    timestamps(type: :utc_datetime)
  end

  def changeset(policy_set, attrs) do
    policy_set
    |> cast(attrs, [:version, :name, :data, :active])
    |> validate_required([:data])
  end
end
