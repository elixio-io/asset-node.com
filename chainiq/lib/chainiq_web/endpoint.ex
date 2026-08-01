defmodule ChainiqWeb.Endpoint do
  use Phoenix.Endpoint, otp_app: :chainiq

  @session_options [
    store: :cookie,
    key: "_chainiq_key",
    signing_salt: "boio1QbK",
    same_site: "Lax"
  ]

  plug(Plug.Static,
    at: "/",
    from: :chainiq,
    gzip: not code_reloading?,
    only: ChainiqWeb.static_paths(),
    raise_on_missing_only: code_reloading?
  )

  if code_reloading? do
    plug(Phoenix.CodeReloader)
  end

  plug(Plug.RequestId)
  plug(Plug.Telemetry, event_prefix: [:phoenix, :endpoint])

  plug(Plug.Parsers,
    parsers: [:urlencoded, :multipart, :json],
    pass: ["*/*"],
    json_decoder: Phoenix.json_library()
  )

  plug(Plug.MethodOverride)
  plug(Plug.Head)
  plug(Plug.Session, @session_options)
  plug(CORSPlug, origin: ["http://localhost:5174", "http://localhost:3000"])
  plug(ChainiqWeb.Router)
end
