defmodule ChainiqWeb.DataController do
  use ChainiqWeb, :controller

  alias ChainIQ.Data.{Suppliers, Categories, Policies, Historical}

  def suppliers(conn, _params) do
    data = Suppliers.all()
    json(conn, %{status: "ok", count: length(data), data: data})
  end

  def categories(conn, _params) do
    data = Categories.all()
    json(conn, %{status: "ok", count: length(data), data: data})
  end

  def policies(conn, _params) do
    json(conn, %{status: "ok", data: Policies.get()})
  end

  def historical(conn, _params) do
    data = Historical.all()
    json(conn, %{status: "ok", count: length(data), data: data})
  end
end
