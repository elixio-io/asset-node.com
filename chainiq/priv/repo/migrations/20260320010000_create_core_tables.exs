defmodule ChainIQ.Repo.Migrations.CreateCoreTables do
  use Ecto.Migration

  def change do

    create table(:suppliers, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:supplier_id, :string, null: false)
      add(:name, :string, null: false)
      add(:category_l1, :string, null: false)
      add(:category_l2, :string, null: false)
      add(:country_hq, :string)
      add(:service_regions, {:array, :string}, default: [])
      add(:currency, :string)
      add(:pricing_model, :string)
      add(:quality_score, :float)
      add(:risk_score, :float)
      add(:esg_score, :float)
      add(:preferred, :boolean, default: false)
      add(:restricted, :boolean, default: false)
      add(:restriction_reason, :string)
      add(:contract_status, :string)
      add(:data_residency_supported, :boolean, default: false)
      add(:capacity_per_month, :integer)
      add(:notes, :text)

      timestamps(type: :utc_datetime)
    end

    create(unique_index(:suppliers, [:supplier_id, :category_l2]))
    create(index(:suppliers, [:category_l1, :category_l2]))
    create(index(:suppliers, [:contract_status]))


    create table(:pricing_entries, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:pricing_id, :string, null: false)
      add(:supplier_id, :string, null: false)
      add(:category_l1, :string)
      add(:category_l2, :string)
      add(:region, :string)
      add(:currency, :string)
      add(:pricing_model, :string)
      add(:min_quantity, :integer)
      add(:max_quantity, :integer)
      add(:unit_price, :float)
      add(:moq, :integer)
      add(:standard_lead_time_days, :integer)
      add(:expedited_lead_time_days, :integer)
      add(:expedited_unit_price, :float)
      add(:valid_from, :string)
      add(:valid_to, :string)
      add(:notes, :text)

      timestamps(type: :utc_datetime)
    end

    create(unique_index(:pricing_entries, [:pricing_id]))
    create(index(:pricing_entries, [:supplier_id]))
    create(index(:pricing_entries, [:category_l1, :category_l2]))


    create table(:categories, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:category_l1, :string, null: false)
      add(:category_l2, :string, null: false)
      add(:description, :text)
      add(:typical_unit, :string)
      add(:pricing_model, :string)

      timestamps(type: :utc_datetime)
    end

    create(unique_index(:categories, [:category_l1, :category_l2]))


    create table(:procurement_requests, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:request_id, :string, null: false)
      add(:title, :string)
      add(:category_l1, :string)
      add(:category_l2, :string)
      add(:country, :string)
      add(:business_unit, :string)
      add(:currency, :string)
      add(:budget_amount, :float)
      add(:quantity, :float)
      add(:required_by_date, :string)
      add(:status, :string, default: "pending")
      add(:raw_data, :map)

      timestamps(type: :utc_datetime)
    end

    create(unique_index(:procurement_requests, [:request_id]))


    create table(:policy_sets, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:version, :string, default: "1.0")
      add(:name, :string, default: "default")
      add(:data, :map, null: false)
      add(:active, :boolean, default: true)

      timestamps(type: :utc_datetime)
    end


    create table(:historical_awards, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:award_id, :string, null: false)
      add(:request_id, :string)
      add(:award_date, :string)
      add(:category_l1, :string)
      add(:category_l2, :string)
      add(:country, :string)
      add(:business_unit, :string)
      add(:supplier_id, :string)
      add(:supplier_name, :string)
      add(:total_value, :float)
      add(:currency, :string)
      add(:quantity, :float)
      add(:required_by_date, :string)
      add(:awarded, :boolean, default: false)
      add(:award_rank, :integer)
      add(:decision_rationale, :text)
      add(:policy_compliant, :boolean, default: false)
      add(:preferred_supplier_used, :boolean, default: false)
      add(:escalation_required, :boolean, default: false)
      add(:escalated_to, :string)
      add(:savings_pct, :float)
      add(:lead_time_days, :integer)
      add(:risk_score_at_award, :float)
      add(:notes, :text)

      timestamps(type: :utc_datetime)
    end

    create(unique_index(:historical_awards, [:award_id]))
    create(index(:historical_awards, [:request_id]))
    create(index(:historical_awards, [:supplier_id]))


    create table(:pipeline_results, primary_key: false) do
      add(:id, :binary_id, primary_key: true)
      add(:request_id, :string, null: false)
      add(:status, :string, default: "completed")
      add(:recommendation, :map)
      add(:supplier_shortlist, {:array, :map}, default: [])
      add(:suppliers_excluded, {:array, :map}, default: [])
      add(:policy_evaluation, :map)
      add(:validation, :map)
      add(:escalation, :map)
      add(:ai_enrichment, :map)
      add(:request_interpretation, :map)
      add(:audit_trail, :map)
      add(:processing_time_ms, :integer)

      timestamps(type: :utc_datetime)
    end

    create(index(:pipeline_results, [:request_id]))
  end
end
