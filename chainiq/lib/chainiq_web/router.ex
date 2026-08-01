defmodule ChainiqWeb.Router do
  use ChainiqWeb, :router

  pipeline :api do
    plug(:accepts, ["json"])
  end

  scope "/api", ChainiqWeb do
    pipe_through(:api)

    get("/process/:request_id", RequestController, :process)

    post("/process", RequestController, :process_adhoc)

    post("/process/batch", RequestController, :process_batch)

    post("/parse", RequestController, :parse)

    post("/enrich/:request_id", RequestController, :enrich)

    get("/requests", RequestController, :index)
    get("/requests/:request_id", RequestController, :show)

    get("/suppliers", DataController, :suppliers)
    get("/categories", DataController, :categories)
    get("/policies", DataController, :policies)
    get("/historical", DataController, :historical)

    get("/results", RequestController, :results_index)
    get("/results/:request_id", RequestController, :results_show)
    delete("/results/:request_id", RequestController, :results_delete)

    post("/agent/chat", AgentController, :chat)

    get("/ai/health", HealthController, :ai_health)

    get("/health", HealthController, :check)
  end
end
