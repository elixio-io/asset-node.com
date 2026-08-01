defmodule ChainIQ.Workers.PipelineWorker do
  use Oban.Worker,
    queue: :pipeline,
    max_attempts: 3,
    unique: [keys: [:request_id], period: 300]

  require Logger

  alias ChainIQ.{Pipeline, Repo}
  alias ChainIQ.Schema.{ProcurementRequest, PipelineResult}

  @impl Oban.Worker
  def perform(%Oban.Job{args: %{"request_id" => request_id}}) do
    Logger.info("🔄 PipelineWorker processing #{request_id}")

    case Repo.get_by(ProcurementRequest, request_id: request_id) do
      nil ->
        Logger.error("Request #{request_id} not found in database")
        {:error, :not_found}

      %ProcurementRequest{raw_data: raw_data} ->
        result = Pipeline.process(raw_data)

        attrs = %{
          request_id: request_id,
          status: "completed",
          recommendation: result[:recommendation],
          supplier_shortlist: result[:supplier_shortlist] || [],
          suppliers_excluded: result[:suppliers_excluded] || [],
          policy_evaluation: result[:policy_evaluation],
          validation: result[:validation],
          escalation: result[:escalation],
          ai_enrichment: result[:ai_enrichment],
          request_interpretation: result[:request_interpretation],
          audit_trail: result[:audit_trail],
          processing_time_ms: result[:processing_time_ms]
        }

        %PipelineResult{}
        |> PipelineResult.changeset(attrs)
        |> Repo.insert!(
          on_conflict:
            {:replace,
             [
               :status,
               :recommendation,
               :supplier_shortlist,
               :suppliers_excluded,
               :policy_evaluation,
               :validation,
               :escalation,
               :ai_enrichment,
               :request_interpretation,
               :audit_trail,
               :processing_time_ms,
               :updated_at
             ]},
          conflict_target: [:request_id]
        )

        Logger.info(
          "✅ PipelineWorker completed #{request_id} in #{result[:processing_time_ms]}ms"
        )

        :ok
    end
  end
end
