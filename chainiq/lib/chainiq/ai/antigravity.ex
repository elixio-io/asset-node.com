defmodule ChainIQ.AI.Antigravity do
  require Logger

  @default_model "gemini-3-flash-preview"
  @fallback_model "gemini-2.0-flash"
  @timeout 120_000

  defp get_api_key do
    Application.get_env(:chainiq, :gemini_api_key) || System.get_env("GEMINI_API_KEY")
  end

  def chat(messages, opts \\ []) do
    model = opts[:model] || @default_model
    temperature = opts[:temperature] || 0.1
    max_tokens = opts[:max_tokens] || 4096
    json_mode = opts[:json_mode] || false

    {system_msgs, other_msgs} = Enum.split_with(messages, &(&1.role == "system"))

    contents =
      Enum.map(other_msgs, fn msg ->
        role = if msg.role == "assistant", do: "model", else: "user"
        %{role: role, parts: [%{text: msg.content}]}
      end)

    body = %{
      contents: contents,
      generationConfig: %{
        temperature: temperature,
        maxOutputTokens: max_tokens
      }
    }

    body =
      if system_msgs != [] do
        sys_text = Enum.map_join(system_msgs, "\n", & &1.content)
        Map.put(body, :systemInstruction, %{parts: [%{text: sys_text}]})
      else
        body
      end

    body =
      if json_mode do
        put_in(body, [:generationConfig, :responseMimeType], "application/json")
      else
        body
      end

    case do_request(model, body) do
      {:ok, content} ->
        {:ok, content}

      {:error, reason} when model != @fallback_model ->
        Logger.warning(
          "Primary model failed (#{inspect(reason)}), trying fallback #{@fallback_model}"
        )

        do_request(@fallback_model, body)

      {:error, reason} ->
        {:error, reason}
    end
  end

  def prompt(system_prompt, user_prompt, opts \\ []) do
    messages = [
      %{role: "system", content: system_prompt},
      %{role: "user", content: user_prompt}
    ]

    chat(messages, opts)
  end

  def prompt_json(system_prompt, user_prompt, opts \\ []) do
    case prompt(system_prompt, user_prompt, Keyword.put(opts, :json_mode, true)) do
      {:ok, content} ->
        json_str =
          content
          |> String.trim()
          |> extract_json_block()

        case Jason.decode(json_str) do
          {:ok, data} -> {:ok, data}
          {:error, _} -> {:error, {:json_parse, content}}
        end

      error ->
        error
    end
  end

  def health_check do
    api_key = get_api_key()
    if is_nil(api_key), do: throw({:error, "GEMINI_API_KEY missing"})

    url = "https://generativelanguage.googleapis.com/v1beta/models?key=#{api_key}"

    case Req.get(url, receive_timeout: 5_000) do
      {:ok, %{status: 200}} -> :ok
      {:ok, %{status: status}} -> {:error, {:status, status}}
      {:error, reason} -> {:error, reason}
    end
  rescue
    e -> {:error, {:exception, Exception.message(e)}}
  end

  defp do_request(model, body), do: do_request(model, body, _attempt = 1)

  defp do_request(model, body, attempt) do
    api_key = get_api_key()
    if is_nil(api_key), do: throw({:error, "GEMINI_API_KEY missing"})

    url =
      "https://generativelanguage.googleapis.com/v1beta/models/#{model}:generateContent?key=#{api_key}"

    case Req.post(url,
           json: body,
           receive_timeout: @timeout,
           connect_options: [timeout: 10_000]
         ) do
      {:ok,
       %{
         status: 200,
         body: %{"candidates" => [%{"content" => %{"parts" => [%{"text" => content} | _]}} | _]}
       }} ->
        {:ok, content}

      {:ok, %{status: 200, body: resp_body}} ->
        Logger.error("Unexpected response shape: #{inspect(resp_body)}")
        {:error, {:unexpected_response, resp_body}}

      {:ok, %{status: status}} when status in [429, 503, 500] and attempt < 4 ->
        delay = :timer.seconds(attempt)
        Logger.warning("API #{status}, retry #{attempt}/3 after #{attempt}s...")
        Process.sleep(delay)
        do_request(model, body, attempt + 1)

      {:ok, %{status: status, body: resp_body}} ->
        Logger.error("API error #{status}: #{inspect(resp_body)}")
        {:error, {:api_error, status, resp_body}}

      {:error, %{reason: reason}} ->
        Logger.error("HTTP error: #{inspect(reason)}")
        {:error, {:http_error, reason}}

      {:error, reason} ->
        Logger.error("Request failed: #{inspect(reason)}")
        {:error, {:request_failed, reason}}
    end
  rescue
    e ->
      Logger.error("Exception calling Gemini API: #{Exception.message(e)}")
      {:error, {:exception, Exception.message(e)}}
  end

  defp extract_json_block(str) do
    case Regex.run(~r/```(?:json)?\s*\n?([\s\S]*?)\n?```/, str) do
      [_, json] -> String.trim(json)
      nil -> str
    end
  end
end
