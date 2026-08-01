defmodule ChainIQ.Schema.HistoricalAward do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}

  schema "historical_awards" do
    field(:award_id, :string)
    field(:request_id, :string)
    field(:award_date, :string)
    field(:category_l1, :string)
    field(:category_l2, :string)
    field(:country, :string)
    field(:business_unit, :string)
    field(:supplier_id, :string)
    field(:supplier_name, :string)
    field(:total_value, :float)
    field(:currency, :string)
    field(:quantity, :float)
    field(:required_by_date, :string)
    field(:awarded, :boolean, default: false)
    field(:award_rank, :integer)
    field(:decision_rationale, :string)
    field(:policy_compliant, :boolean, default: false)
    field(:preferred_supplier_used, :boolean, default: false)
    field(:escalation_required, :boolean, default: false)
    field(:escalated_to, :string)
    field(:savings_pct, :float)
    field(:lead_time_days, :integer)
    field(:risk_score_at_award, :float)
    field(:notes, :string)

    timestamps(type: :utc_datetime)
  end

  @required ~w(award_id request_id supplier_id)a
  @optional ~w(award_date category_l1 category_l2 country business_unit supplier_name total_value currency quantity required_by_date awarded award_rank decision_rationale policy_compliant preferred_supplier_used escalation_required escalated_to savings_pct lead_time_days risk_score_at_award notes)a

  def changeset(award, attrs) do
    award
    |> cast(attrs, @required ++ @optional)
    |> validate_required(@required)
    |> unique_constraint(:award_id)
  end
end
