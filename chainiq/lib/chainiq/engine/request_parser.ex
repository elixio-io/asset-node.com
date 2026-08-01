defmodule ChainIQ.Engine.RequestParser do
  require Logger
  alias ChainIQ.AI.Antigravity
  alias ChainIQ.Data.Categories

  def parse(text, opts \\ []) when is_binary(text) do
    use_ai = Keyword.get(opts, :use_ai, true)

    if use_ai do
      case parse_with_ai(text) do
        {:ok, parsed} ->
          {:ok, merge_with_heuristics(parsed, text)}

        {:error, reason} ->
          Logger.warning("AI parsing failed (#{inspect(reason)}), using heuristics")
          {:ok, parse_with_heuristics(text)}
      end
    else
      {:ok, parse_with_heuristics(text)}
    end
  end

  def enrich(request) when is_map(request) do
    text = request["request_text"] || ""

    if byte_size(text) < 10 do
      {:ok, request}
    else
      case analyze_with_ai(text, request) do
        {:ok, enrichment} -> {:ok, Map.merge(request, %{"ai_enrichment" => enrichment})}
        {:error, _} -> {:ok, request}
      end
    end
  end

  defp system_prompt do
    categories_text = format_categories()

    """
    You are a procurement data extraction system. Given a purchase request text,
    extract structured procurement data. Be precise and conservative — only extract
    what is explicitly stated or strongly implied.

    Return a JSON object with these fields:
    - title: string — short descriptive title for the request
    - category_l1: string — top-level category
    - category_l2: string — sub-category
    - quantity: number — quantity requested
    - unit_of_measure: string — unit type (e.g., "units", "consulting_day", "licenses")
    - budget_amount: number — total budget in the stated currency
    - currency: string — ISO currency code (EUR, USD, CHF, GBP, JPY)
    - country: string — ISO 2-letter country code for delivery
    - delivery_countries: [string] — array of ISO country codes
    - required_by_date: string — ISO date (YYYY-MM-DD) or null
    - preferred_supplier_mentioned: string or null — supplier name if mentioned
    - urgency: string — "standard", "urgent", or "critical"
    - esg_requirement: boolean — true if sustainability/ESG is mentioned
    - data_residency_constraint: boolean — true if data residency is mentioned
    - key_requirements: [string] — list of specific requirements extracted
    - detected_language: string — ISO 639-1 language code of the input text
    - confidence: number — 0.0 to 1.0 confidence in extraction quality

    IMPORTANT: The categories MUST match from this list:
    #{categories_text}

    If a field cannot be determined, use null. Always respond with valid JSON only.
    """
  end

  defp parse_with_ai(text) do
    Antigravity.prompt_json(
      system_prompt(),
      "Parse this purchase request:\n\n#{text}",
      temperature: 0.1,
      max_tokens: 2048
    )
  end

  defp analyze_with_ai(text, request) do
    analysis_prompt = """
    Analyze this procurement request and provide insights:

    Request text: #{text}
    Category: #{request["category_l1"]}/#{request["category_l2"]}
    Budget: #{request["budget_amount"]} #{request["currency"]}
    Country: #{request["country"]}

    Return a JSON object with:
    - intent: string — "standard_purchase", "emergency", "strategic_sourcing", "compliance_driven"
    - risk_indicators: [string] — any red flags (e.g., "unusually high budget", "very tight deadline")
    - negotiation_leverage: string — "high", "medium", "low" based on market dynamics
    - suggested_negotiation_points: [string] — specific areas to negotiate
    - text_sentiment: string — "neutral", "urgent", "frustrated", "formal"
    - key_entities: [string] — important names, dates, or specifications mentioned
    - summary: string — one-sentence summary of the request
    """

    Antigravity.prompt_json(
      "You are a procurement analysis assistant. Always respond with valid JSON.",
      analysis_prompt,
      temperature: 0.2,
      max_tokens: 1024
    )
  end

  defp parse_with_heuristics(text) do
    %{
      "title" => extract_title(text),
      "quantity" => extract_quantity(text),
      "budget_amount" => extract_budget(text),
      "currency" => extract_currency(text),
      "required_by_date" => extract_date(text),
      "preferred_supplier_mentioned" => extract_supplier(text),
      "urgency" => detect_urgency(text),
      "detected_language" => detect_language(text),
      "key_requirements" => extract_requirements(text),
      "esg_requirement" => detect_esg(text),
      "data_residency_constraint" => detect_data_residency(text),
      "confidence" => 0.5,
      "parsing_method" => "heuristic"
    }
  end

  defp merge_with_heuristics(parsed, text) do
    heuristic = parse_with_heuristics(text)

    merged =
      Map.merge(heuristic, parsed, fn _key, heur, ai ->
        if is_nil(ai), do: heur, else: ai
      end)

    Map.put(merged, "parsing_method", "ai+heuristic")
  end

  defp extract_title(text) do
    text
    |> String.split(~r/[.\n]/, parts: 2)
    |> List.first()
    |> String.slice(0, 100)
    |> String.trim()
  end

  defp extract_quantity(text) do
    case Regex.run(
           ~r/(?:need|require|order|requesting|benötigen|recherchons|necesitamos|precisamos)\s+(\d[\d,.]*)\s/iu,
           text
         ) do
      [_, qty] ->
        qty |> String.replace(~r/[,.]/, "") |> String.to_integer()

      nil ->
        case Regex.run(
               ~r/(\d[\d,.]*)\s+(?:units?|pieces?|devices?|laptops?|desks?|monitors?|tablets?|licenses?|Geräte|Bürogeräte|licencias|appareils)/iu,
               text
             ) do
          [_, qty] -> qty |> String.replace(~r/[,.]/, "") |> String.to_integer()
          nil -> nil
        end
    end
  end

  defp extract_budget(text) do
    pattern =
      ~r/(?:budget|approximately|~|around|environ|ca\.|presupuesto|or(?:ç|c)amento)\s*(?:is\s+)?:?\s*(?:approximately\s+)?([€$£¥]?\s*[\d,]+(?:\.\d{1,2})?)\s*(?:EUR|USD|CHF|GBP|JPY)?/iu

    case Regex.run(pattern, text) do
      [_, amount] ->
        amount
        |> String.replace(~r/[€$£¥\s]/, "")
        |> String.replace(",", "")
        |> Float.parse()
        |> case do
          {f, _} -> f
          :error -> nil
        end

      nil ->
        nil
    end
  end

  defp extract_currency(text) do
    case Regex.run(~r/(EUR|USD|CHF|GBP|JPY)/i, text) do
      [_, cur] ->
        String.upcase(cur)

      nil ->
        cond do
          String.contains?(text, "€") -> "EUR"
          String.contains?(text, "$") -> "USD"
          String.contains?(text, "£") -> "GBP"
          String.contains?(text, "¥") -> "JPY"
          true -> nil
        end
    end
  end

  defp extract_date(text) do
    case Regex.run(~r/(\d{4}-\d{2}-\d{2})/, text) do
      [_, date] -> date
      nil -> nil
    end
  end

  defp extract_supplier(text) do
    case Regex.run(
           ~r/(?:prefer|recommend|use|contact|from)\s+([A-Z][A-Za-z\s&]+?)(?:\s+if|\s+for|\.|\z)/i,
           text
         ) do
      [_, supplier] -> String.trim(supplier)
      nil -> nil
    end
  end

  defp detect_urgency(text) do
    text_lower = String.downcase(text)

    cond do
      String.contains?(text_lower, ["critical", "emergency", "immediately", "asap", "sofort"]) ->
        "critical"

      String.contains?(text_lower, [
        "urgent",
        "urgently",
        "rush",
        "expedite",
        "dringend",
        "urgente",
        "urgentemente"
      ]) ->
        "urgent"

      true ->
        "standard"
    end
  end

  defp detect_language(text) do
    text_lower = String.downcase(text)

    cond do
      Regex.match?(~r/\b(bonjour|nous|souhaitons|prestataire|recherchons)\b/, text_lower) -> "fr"
      Regex.match?(~r/\b(benötigen|dringend|Lieferung|büro|geräte)\b/i, text) -> "de"
      Regex.match?(~r/\b(necesitamos|solicitud|presupuesto|proveedor)\b/, text_lower) -> "es"
      Regex.match?(~r/\b(precisamos|necessidade|fornecedor|orçamento)\b/, text_lower) -> "pt"
      Regex.match?(~r/[\p{Han}\p{Hiragana}\p{Katakana}]/u, text) -> "ja"
      true -> "en"
    end
  end

  defp extract_requirements(text) do
    keywords =
      ~w(warranty SLA support delivery certification compliance security backup training maintenance)

    keywords
    |> Enum.filter(fn kw -> String.contains?(String.downcase(text), String.downcase(kw)) end)
  end

  defp detect_esg(text) do
    text_lower = String.downcase(text)

    String.contains?(text_lower, [
      "esg",
      "sustainability",
      "green",
      "carbon",
      "environmental",
      "nachhaltig"
    ])
  end

  defp detect_data_residency(text) do
    text_lower = String.downcase(text)

    String.contains?(text_lower, [
      "data residency",
      "data sovereignty",
      "gdpr",
      "local data",
      "datenschutz"
    ])
  end

  defp format_categories do
    Categories.all()
    |> Enum.map(fn cat -> "#{cat.category_l1}/#{cat.category_l2}" end)
    |> Enum.join("\n")
  end
end
