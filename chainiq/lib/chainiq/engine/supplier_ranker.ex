defmodule ChainIQ.Engine.SupplierRanker do
  alias ChainIQ.Engine.HistoricalAnalyzer

  @price_weight 0.40
  @quality_weight 0.25
  @risk_weight 0.20
  @esg_weight 0.15

  def rank(pricing_results, request \\ %{}) do
    valid = Enum.filter(pricing_results, fn p -> p[:unit_price] != nil end)

    if valid == [] do
      {[], %{reason: "no_valid_pricing"}}
    else
      max_price = valid |> Enum.map(& &1.total) |> Enum.max()
      min_price = valid |> Enum.map(& &1.total) |> Enum.min()
      price_range = max(max_price - min_price, 1)

      ranked =
        valid
        |> Enum.map(fn supplier ->
          price_score = 1.0 - (supplier.total - min_price) / price_range

          quality_score = (supplier.quality_score || 50) / 100.0

          risk_score = 1.0 - (supplier.risk_score || 50) / 100.0

          esg_score = (supplier.esg_score || 50) / 100.0

          composite =
            price_score * @price_weight +
              quality_score * @quality_weight +
              risk_score * @risk_weight +
              esg_score * @esg_weight

          pref_bonus = if supplier[:preferred], do: 0.05, else: 0.0

          category_l1 = request["category_l1"] || ""
          category_l2 = request["category_l2"] || ""

          hist_bonus =
            HistoricalAnalyzer.score_boost(supplier.supplier_id, category_l1, category_l2)

          Map.merge(supplier, %{
            scores: %{
              price: Float.round(price_score, 3),
              quality: Float.round(quality_score, 3),
              risk: Float.round(risk_score, 3),
              esg: Float.round(esg_score, 3),
              composite: Float.round(composite + pref_bonus + hist_bonus, 3),
              preferred_bonus: pref_bonus,
              historical_bonus: hist_bonus
            },
            rank: nil
          })
        end)
        |> Enum.sort_by(fn s -> -s.scores.composite end)
        |> Enum.with_index(1)
        |> Enum.map(fn {s, idx} -> %{s | rank: idx} end)

      budget = request["budget_amount"]

      recommendation =
        case ranked do
          [top | _] ->
            within_budget = budget == nil or top.total <= budget

            %{
              recommended_supplier: top.supplier_id,
              recommended_supplier_name: top.supplier_name,
              composite_score: top.scores.composite,
              total_cost: top.total,
              within_budget: within_budget,
              reason: build_recommendation_reason(top, within_budget)
            }

          [] ->
            %{reason: "no_suppliers_available"}
        end

      {ranked, recommendation}
    end
  end

  defp build_recommendation_reason(top, within_budget) do
    parts = [
      "Highest composite score (#{top.scores.composite})",
      "Price: #{top.scores.price} (weight #{Float.round(@price_weight * 100, 0)}%)",
      "Quality: #{top.scores.quality} (weight #{Float.round(@quality_weight * 100, 0)}%)",
      "Risk: #{top.scores.risk} (weight #{Float.round(@risk_weight * 100, 0)}%)",
      "ESG: #{top.scores.esg} (weight #{Float.round(@esg_weight * 100, 0)}%)"
    ]

    parts =
      if top.scores[:historical_bonus] && top.scores.historical_bonus > 0,
        do: parts ++ ["Historical precedent bonus: +#{top.scores.historical_bonus}"],
        else: parts

    parts = if top[:preferred], do: parts ++ ["Preferred supplier bonus applied"], else: parts
    parts = unless within_budget, do: parts ++ ["⚠ Exceeds budget"], else: parts

    Enum.join(parts, "; ")
  end
end
