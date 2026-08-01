defmodule ChainIQ.Engine.HistoricalAnalyzer do
  alias ChainIQ.Data.Historical

  def score_boost(supplier_id, category_l1, category_l2) do
    awards = Historical.wins_for_supplier(supplier_id)

    if Enum.empty?(awards) do
      0.0
    else
      category_awards =
        Enum.filter(awards, fn a ->
          a.category_l1 == category_l1 or a.category_l2 == category_l2
        end)

      total_awards = length(awards)
      category_match_count = length(category_awards)

      volume_score = min(total_awards / 20, 1.0) * 0.05

      category_score = min(category_match_count / 5, 1.0) * 0.05

      recency_score = recency_bonus(awards)

      Float.round(volume_score + category_score + recency_score, 4)
    end
  end

  def analyze(supplier_id) do
    awards = Historical.wins_for_supplier(supplier_id)

    if Enum.empty?(awards) do
      %{
        total_awards: 0,
        categories_served: [],
        avg_discount_pct: 0.0,
        recency_score: 0.0,
        win_trend: "none"
      }
    else
      categories =
        awards
        |> Enum.map(fn a -> "#{a.category_l1}/#{a.category_l2}" end)
        |> Enum.uniq()

      discounts =
        awards
        |> Enum.map(fn a -> a.discount_pct || 0.0 end)
        |> Enum.filter(&(&1 > 0))

      avg_discount =
        if Enum.empty?(discounts),
          do: 0.0,
          else: (Enum.sum(discounts) / length(discounts)) |> Float.round(2)

      %{
        total_awards: length(awards),
        categories_served: categories,
        avg_discount_pct: avg_discount,
        recency_score: recency_bonus(awards),
        win_trend: compute_trend(awards)
      }
    end
  end

  defp recency_bonus(awards) do
    now = Date.utc_today()

    recent =
      Enum.count(awards, fn a ->
        case a.award_date do
          %Date{} = d -> Date.diff(now, d) < 365
          _ -> false
        end
      end)

    (min(recent / 3, 1.0) * 0.05)
    |> Float.round(4)
  end

  defp compute_trend(awards) do
    sorted =
      Enum.sort_by(awards, fn a ->
        case a.award_date do
          %Date{} = d -> Date.to_iso8601(d)
          _ -> "0000-01-01"
        end
      end)

    total = length(sorted)
    if total < 4, do: "insufficient_data", else: do_compute_trend(sorted, total)
  end

  defp do_compute_trend(sorted, total) do
    mid = div(total, 2)
    {first_half, second_half} = Enum.split(sorted, mid)

    first_count = length(first_half)
    second_count = length(second_half)

    cond do
      second_count > first_count * 1.3 -> "increasing"
      second_count < first_count * 0.7 -> "decreasing"
      true -> "stable"
    end
  end
end
