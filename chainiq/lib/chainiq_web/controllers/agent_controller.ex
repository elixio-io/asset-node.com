defmodule ChainiqWeb.AgentController do
  use ChainiqWeb, :controller

  alias ChainIQ.Agent

  def chat(conn, %{"message" => message} = params) do
    history = params["history"] || []
    context = params["context"] || %{}

    org_id =
      case get_req_header(conn, "x-org-id") do
        [id | _] -> id
        _ -> nil
      end

    secure_context = Map.put(context, "org_id", org_id)

    {:ok, response} = Agent.converse(message, history, secure_context)
    json(conn, %{status: "ok", data: response})
  end

  def chat(conn, _params) do
    conn
    |> put_status(400)
    |> json(%{status: "error", message: "Missing 'message' field"})
  end
end
