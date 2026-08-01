defmodule ChainIQ.Schema.PipelineResult do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @derive {Jason.Encoder, except: [:__meta__]}

  schema "pipeline_results" do
    field(:request_id, :string)
    field(:status, :string, default: "completed")
    field(:recommendation, :map)
    field(:supplier_shortlist, {:array, :map}, default: [])
    field(:suppliers_excluded, {:array, :map}, default: [])
    field(:policy_evaluation, :map)
    field(:validation, :map)
    field(:escalation, :map)
    field(:ai_enrichment, :map)
    field(:request_interpretation, :map)
    field(:audit_trail, :map)
    field(:processing_time_ms, :integer)

    timestamps(type: :utc_datetime)
  end

  @required ~w(request_id)a
  @optional ~w(status recommendation supplier_shortlist suppliers_excluded policy_evaluation validation escalation ai_enrichment request_interpretation audit_trail processing_time_ms)a

  def changeset(result, attrs) do
    result
    |> cast(attrs, @required ++ @optional)
    |> validate_required(@required)
  end
end
