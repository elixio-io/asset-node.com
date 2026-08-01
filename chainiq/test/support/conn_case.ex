defmodule ChainiqWeb.ConnCase do
  use ExUnit.CaseTemplate

  using do
    quote do
      @endpoint ChainiqWeb.Endpoint

      use ChainiqWeb, :verified_routes

      import Plug.Conn
      import Phoenix.ConnTest
      import ChainiqWeb.ConnCase
    end
  end

  setup _tags do
    {:ok, conn: Phoenix.ConnTest.build_conn()}
  end
end
