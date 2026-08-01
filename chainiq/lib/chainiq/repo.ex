defmodule ChainIQ.Repo do
  use Ecto.Repo,
    otp_app: :chainiq,
    adapter: Ecto.Adapters.Postgres
end
