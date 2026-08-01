defmodule ChainIQ.Data.Historical do
  import Ecto.Query
  alias ChainIQ.Repo
  alias ChainIQ.Schema.HistoricalAward

  def all do
    Repo.all(HistoricalAward)
  end

  def by_category(category_l1, category_l2) do
    Repo.all(
      from(a in HistoricalAward,
        where: a.category_l1 == ^category_l1 and a.category_l2 == ^category_l2
      )
    )
  end

  def wins_for_supplier(supplier_id) do
    Repo.all(
      from(a in HistoricalAward,
        where: a.supplier_id == ^supplier_id and a.awarded == true
      )
    )
  end

  def win_rate(supplier_id, category_l1, category_l2) do
    awards =
      by_category(category_l1, category_l2)
      |> Enum.filter(fn a -> a.supplier_id == supplier_id end)

    total = length(awards)
    wins = Enum.count(awards, fn a -> a.awarded end)

    if total > 0, do: wins / total, else: nil
  end

  def avg_savings(supplier_id, category_l1, category_l2) do
    savings =
      by_category(category_l1, category_l2)
      |> Enum.filter(fn a ->
        a.supplier_id == supplier_id and a.awarded and a.savings_pct != nil
      end)
      |> Enum.map(& &1.savings_pct)

    if savings != [], do: Enum.sum(savings) / length(savings), else: nil
  end
end
