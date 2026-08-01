defmodule ChainIQ.Data.Loader do
  require Logger

  @data_dir :code.priv_dir(:chainiq) |> Path.join("data")

  def load_all do
    Logger.info("Loading ChainIQ policies from #{@data_dir}")
    load_policies()
    :ok
  end

  defp load_policies do
    path = Path.join(@data_dir, "policies.json")

    if File.exists?(path) do
      policies = path |> File.read!() |> Jason.decode!()
      :persistent_term.put(:chainiq_policies, policies)
      Logger.info("  ✅ Policies loaded into persistent_term")
    else
      Logger.warning("  ⚠️  policies.json not found at #{path}")
    end
  end
end
