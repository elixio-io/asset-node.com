defmodule ChainIQ.Data.Categories do
  import Ecto.Query
  alias ChainIQ.Repo
  alias ChainIQ.Schema.Category

  def all do
    Repo.all(Category)
  end

  def lookup(category_l1, category_l2) do
    case Repo.one(
           from(c in Category,
             where: c.category_l1 == ^category_l1 and c.category_l2 == ^category_l2
           )
         ) do
      nil -> {:error, :not_found}
      cat -> {:ok, cat}
    end
  end

  def valid?(category_l1, category_l2) do
    match?({:ok, _}, lookup(category_l1, category_l2))
  end

  def l1_categories do
    Repo.all(
      from(c in Category,
        select: c.category_l1,
        distinct: true,
        order_by: c.category_l1
      )
    )
  end

  def l2_for_l1(category_l1) do
    Repo.all(
      from(c in Category,
        where: c.category_l1 == ^category_l1,
        select: c.category_l2,
        order_by: c.category_l2
      )
    )
  end
end
