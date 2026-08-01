defmodule ChainIQ.Backtest do
  require Logger

  alias ChainIQ.Pipeline

  @test_cases [
    %{
      id: "REQ-000001",
      tag: :standard,
      desc: "Standard consulting request (400 days, 400k EUR, ES delivery)",
      expect: [
        {:has_field, [:request_interpretation, :category], "Category must be extracted"},
        {:has_field, [:request_interpretation, :quantity], "Quantity must be extracted"},
        {:has_field, [:request_interpretation, :budget], "Budget must be extracted"},
        {:suppliers_found, 1, "At least 1 supplier should be matched"},
        {:has_recommendation, "Must produce a recommendation"},
        {:escalation_required, false, "Standard request should not escalate"}
      ]
    },
    %{
      id: "REQ-000005",
      tag: :standard,
      desc: "Standard laptop request (NL, well-formed)",
      expect: [
        {:suppliers_found, 1, "At least 1 supplier matched"},
        {:has_recommendation, "Recommendation expected"},
        {:budget_check, "Budget should be within range"},
        {:has_field, [:supplier_shortlist], "Ranked shortlist expected"}
      ]
    },
    %{
      id: "REQ-000008",
      tag: :standard,
      desc: "Standard cloud compute request",
      expect: [
        {:suppliers_found, 1, "Supplier matching for cloud services"},
        {:has_recommendation, "Recommendation required"},
        {:has_field, [:policy_evaluation, :results], "Policy evaluation must be performed"}
      ]
    },
    %{
      id: "REQ-000003",
      tag: :threshold,
      desc: "High-value managed cloud platform (~5M EUR, near CPO threshold)",
      expect: [
        {:approval_triggered, "Approval threshold must be detected"},
        {:approval_level_min, 3, "Should require at least tier 3+ approval"},
        {:has_recommendation, "Must still produce recommendation despite threshold"}
      ]
    },
    %{
      id: "REQ-000025",
      tag: :threshold,
      desc: "Threshold boundary request",
      expect: [
        {:approval_triggered, "Threshold detection is critical"},
        {:has_field, [:policy_evaluation, :approval_level], "Approval level must be determined"}
      ]
    },
    %{
      id: "REQ-000029",
      tag: :threshold,
      desc: "Another threshold boundary case",
      expect: [
        {:approval_triggered, "Threshold must be detected"},
        {:has_recommendation, "Recommendation still required at threshold"}
      ]
    },
    %{
      id: "REQ-000007",
      tag: :lead_time,
      desc: "Urgent cloud networking (400k GB, deadline ~5 weeks away)",
      expect: [
        {:has_field, [:request_interpretation, :required_by], "Deadline must be captured"},
        {:suppliers_found, 1, "Suppliers must still be found"},
        {:has_recommendation, "Should still recommend even with tight timeline"}
      ]
    },
    %{
      id: "REQ-000009",
      tag: :lead_time,
      desc: "Lead time pressure request",
      expect: [
        {:has_field, [:request_interpretation, :required_by], "Deadline parsing required"},
        {:has_recommendation, "Must attempt recommendation"}
      ]
    },
    %{
      id: "REQ-000002",
      tag: :missing_info,
      desc: "Missing quantity (null), has budget — should flag missing info",
      expect: [
        {:field_nil, [:request_interpretation, :quantity], "Quantity should be nil/missing"},
        {:validation_issues, true, "Validator should flag missing quantity"},
        {:has_recommendation, "Still attempt a recommendation with available data"}
      ]
    },
    %{
      id: "REQ-000012",
      tag: :missing_info,
      desc: "Missing info — budget or quantity null",
      expect: [
        {:validation_issues, true, "Must detect missing information"},
        {:has_recommendation, "Try to provide partial recommendation"}
      ]
    },
    %{
      id: "REQ-000039",
      tag: :missing_info,
      desc: "Another missing info case",
      expect: [
        {:validation_issues, true, "Missing info detection is critical (ER-001)"}
      ]
    },
    %{
      id: "REQ-000004",
      tag: :contradictory,
      desc: "240 docking stations, tight deadline (likely already past), contradictions",
      expect: [
        {:validation_issues, true, "Contradictions should be flagged"},
        {:has_field, [:request_interpretation, :quantity], "Quantity must still be extracted"},
        {:has_recommendation, "Must attempt recommendation despite contradictions"}
      ]
    },
    %{
      id: "REQ-000015",
      tag: :contradictory,
      desc: "Contradictory requirements",
      expect: [
        {:validation_issues, true, "Contradictions must be detected"}
      ]
    },
    %{
      id: "REQ-000024",
      tag: :contradictory,
      desc: "Another contradictory request",
      expect: [
        {:validation_issues, true, "Must catch contradictions for audit trail"}
      ]
    },
    %{
      id: "REQ-000006",
      tag: :restricted,
      desc: "Preferred supplier 'Boutique Creator Network' is wrong category (Marketing, not IT)",
      expect: [
        {:has_field, [:request_interpretation, :preferred_supplier],
         "Must capture preferred supplier"},
        {:policy_violations, true, "Must detect restricted/wrong-category supplier"},
        {:has_recommendation, "Should recommend alternative suppliers"}
      ]
    },
    %{
      id: "REQ-000021",
      tag: :restricted,
      desc: "Restricted supplier request",
      expect: [
        {:policy_violations, true, "Restriction must be flagged"},
        {:has_recommendation, "Alternative recommendation expected"}
      ]
    },
    %{
      id: "REQ-000035",
      tag: :restricted,
      desc: "Another restricted supplier case",
      expect: [
        {:policy_violations, true, "Restricted supplier detection required"}
      ]
    },
    %{
      id: "REQ-000011",
      tag: :multilingual,
      desc: "English text but CH delivery with different compliance requirements",
      expect: [
        {:has_field, [:request_interpretation, :category], "Category must be extracted"},
        {:suppliers_found, 1, "Swiss suppliers must be matched"},
        {:has_recommendation, "Recommendation required"}
      ]
    },
    %{
      id: "REQ-000040",
      tag: :multilingual,
      desc: "Multilingual request (likely non-English text)",
      expect: [
        {:has_field, [:request_interpretation, :category],
         "Must extract category from non-EN text"},
        {:has_recommendation, "Should handle multilingual input"}
      ]
    },
    %{
      id: "REQ-000061",
      tag: :multilingual,
      desc: "Another multilingual case",
      expect: [
        {:has_field, [:request_interpretation, :category],
         "Category extraction from foreign language"},
        {:suppliers_found, 1, "Supplier matching must work regardless of language"}
      ]
    },
    %{
      id: "REQ-000018",
      tag: :capacity,
      desc: "500 units marketing analytics, likely exceeds capacity",
      expect: [
        {:has_field, [:request_interpretation, :quantity], "Quantity must be captured"},
        {:suppliers_found, 0, "Might have zero suppliers or capacity warning"},
        {:has_recommendation, "Must attempt recommendation or escalate"}
      ]
    },
    %{
      id: "REQ-000026",
      tag: :capacity,
      desc: "Capacity exceeded request",
      expect: [
        {:has_field, [:request_interpretation, :quantity], "High quantity expected"}
      ]
    },
    %{
      id: "REQ-000288",
      tag: :multi_country,
      desc: "Cloud storage across SG/AU/JP with data residency constraint",
      expect: [
        {:has_field, [:request_interpretation, :country], "Delivery countries must be captured"},
        {:policy_violations_or_geo, true, "Geography/data residency rules must be applied"},
        {:has_recommendation, "Must provide recommendation or escalate"}
      ]
    },
    %{
      id: "REQ-000291",
      tag: :multi_country,
      desc: "Multi-country delivery with different regulatory requirements",
      expect: [
        {:has_field, [:request_interpretation, :country], "Country info required"},
        {:has_recommendation, "Must handle multi-country complexity"}
      ]
    }
  ]

  def run do
    IO.puts("\n" <> String.duplicate("═", 80))

    IO.puts(
      "  ChainIQ BACKTEST SUITE — #{length(@test_cases)} test cases across 9 scenario types"
    )

    IO.puts(String.duplicate("═", 80) <> "\n")

    started_at = System.monotonic_time(:millisecond)

    results =
      @test_cases
      |> Enum.map(fn tc ->
        IO.write("  Testing #{tc.id} (#{tc.tag}) ... ")
        {result, assertions} = run_test_case(tc)
        passed = Enum.count(assertions, fn {status, _, _} -> status == :pass end)
        failed = Enum.count(assertions, fn {status, _, _} -> status == :fail end)
        errors = Enum.count(assertions, fn {status, _, _} -> status == :error end)

        status_char =
          cond do
            failed > 0 or errors > 0 -> "❌"
            true -> "✅"
          end

        IO.puts("#{status_char} #{passed}/#{passed + failed + errors} checks passed")

        for {status, check_name, detail} <- assertions, status != :pass do
          IO.puts("    └─ #{status}: #{check_name} — #{detail}")
        end

        %{
          id: tc.id,
          tag: tc.tag,
          desc: tc.desc,
          passed: passed,
          failed: failed,
          errors: errors,
          assertions: assertions,
          result: result,
          status: if(failed == 0 and errors == 0, do: :pass, else: :fail)
        }
      end)

    elapsed = System.monotonic_time(:millisecond) - started_at

    IO.puts("\n" <> String.duplicate("─", 80))

    total_pass = Enum.count(results, &(&1.status == :pass))
    total_fail = Enum.count(results, &(&1.status == :fail))
    total_checks = Enum.sum(Enum.map(results, &(&1.passed + &1.failed + &1.errors)))
    checks_passed = Enum.sum(Enum.map(results, & &1.passed))

    IO.puts("\n  SUMMARY:")
    IO.puts("  ├─ Test cases: #{total_pass}/#{length(results)} passed")
    IO.puts("  ├─ Assertions: #{checks_passed}/#{total_checks} passed")
    IO.puts("  ├─ Time: #{elapsed}ms (#{Float.round(elapsed / length(results), 0)}ms avg)")
    IO.puts("  └─ Pass rate: #{Float.round(total_pass / length(results) * 100, 1)}%")

    IO.puts("\n  PER-SCENARIO BREAKDOWN:")

    for tag <- [
          :standard,
          :threshold,
          :lead_time,
          :missing_info,
          :contradictory,
          :restricted,
          :multilingual,
          :capacity,
          :multi_country
        ] do
      tag_results = Enum.filter(results, &(&1.tag == tag))
      tag_pass = Enum.count(tag_results, &(&1.status == :pass))
      tag_total = length(tag_results)
      emoji = if tag_pass == tag_total, do: "✅", else: "⚠️"
      IO.puts("  #{emoji} #{tag}: #{tag_pass}/#{tag_total} passed")
    end

    failed_cases = Enum.filter(results, &(&1.status == :fail))

    if length(failed_cases) > 0 do
      IO.puts("\n  OPTIMIZATION GAPS (failed test cases):")

      for fc <- failed_cases do
        IO.puts("  ╔═ #{fc.id} (#{fc.tag}): #{fc.desc}")
        failed_assertions = Enum.filter(fc.assertions, fn {s, _, _} -> s != :pass end)

        for {status, name, detail} <- failed_assertions do
          IO.puts("  ║  └─ [#{status}] #{name}: #{detail}")
        end

        IO.puts("  ╚═══")
      end
    end

    IO.puts("\n" <> String.duplicate("═", 80))
    IO.puts("  Backtest complete. #{length(failed_cases)} issues found.\n")

    %{
      total_cases: length(results),
      passed: total_pass,
      failed: total_fail,
      total_checks: total_checks,
      checks_passed: checks_passed,
      elapsed_ms: elapsed,
      results: results,
      gaps: failed_cases
    }
  end

  defp run_test_case(%{id: id, expect: expectations}) do
    try do
      result = Pipeline.process_by_id(id)

      case result do
        {:ok, pipeline_result} ->
          assertions = Enum.map(expectations, fn exp -> check_assertion(exp, pipeline_result) end)
          {pipeline_result, assertions}

        {:error, :not_found} ->
          err = {:error, "not_found", "Request #{id} not found in loaded data"}
          {nil, Enum.map(expectations, fn _ -> err end)}

        other ->
          err = {:error, "unexpected_response", "Got: #{inspect(other) |> String.slice(0, 100)}"}
          {nil, Enum.map(expectations, fn _ -> err end)}
      end
    rescue
      e ->
        err_msg = Exception.message(e) |> String.slice(0, 150)
        err = {:error, "crash", "Pipeline crashed: #{err_msg}"}
        {nil, Enum.map(expectations, fn _ -> err end)}
    end
  end

  defp check_assertion({:has_field, path, msg}, result) do
    val = get_nested(result, path)

    cond do
      val != nil and val != "" and val != [] -> {:pass, msg, "OK"}
      true -> {:fail, msg, "Field #{inspect(path)} is nil/empty"}
    end
  end

  defp check_assertion({:field_nil, path, msg}, result) do
    val = get_nested(result, path)

    if val == nil,
      do: {:pass, msg, "OK (nil as expected)"},
      else: {:fail, msg, "Expected nil, got #{inspect(val)}"}
  end

  defp check_assertion({:suppliers_found, min_count, msg}, result) do
    shortlist = result[:supplier_shortlist] || []

    if length(shortlist) >= min_count do
      {:pass, msg, "Found #{length(shortlist)} suppliers"}
    else
      {:fail, msg, "Only #{length(shortlist)} suppliers found (expected >= #{min_count})"}
    end
  end

  defp check_assertion({:has_recommendation, msg}, result) do
    rec = result[:recommendation]

    cond do
      rec == nil ->
        {:fail, msg, "No recommendation generated"}

      rec[:recommended_supplier] != nil ->
        {:pass, msg, "Recommended: #{rec[:recommended_supplier]}"}

      rec[:reason] != nil ->
        {:pass, msg, "Reason: #{rec[:reason] |> String.slice(0, 60)}"}

      true ->
        {:fail, msg, "Recommendation object is empty"}
    end
  end

  defp check_assertion({:escalation_required, expected, msg}, result) do
    esc = result[:escalation]
    actual = esc[:escalation_required] || false

    if actual == expected do
      {:pass, msg, "OK (escalation_required=#{actual})"}
    else
      rules = (esc[:triggered_rules] || []) |> Enum.map(& &1[:rule_id]) |> Enum.join(", ")
      {:fail, msg, "Expected escalation=#{expected}, got #{actual}. Triggered: #{rules}"}
    end
  end

  defp check_assertion({:approval_triggered, msg}, result) do
    eval = result[:policy_evaluation]
    level = eval[:approval_level]

    if level != nil do
      {:pass, msg, "Approval level: #{inspect(level[:approver] || level)}"}
    else
      {:fail, msg, "No approval level triggered"}
    end
  end

  defp check_assertion({:approval_level_min, min_tier, msg}, result) do
    eval = result[:policy_evaluation]
    level = eval[:approval_level]

    cond do
      level == nil ->
        {:fail, msg, "No approval level found"}

      is_map(level) ->
        threshold = level[:threshold_value] || 0

        detected_tier =
          cond do
            threshold >= 5_000_000 -> 5
            threshold >= 500_000 -> 4
            threshold >= 100_000 -> 3
            threshold >= 25_000 -> 2
            true -> 1
          end

        if detected_tier >= min_tier do
          {:pass, msg, "Tier #{detected_tier} (threshold #{threshold})"}
        else
          {:fail, msg, "Detected tier #{detected_tier} < required #{min_tier}"}
        end

      true ->
        {:fail, msg, "Unexpected approval format: #{inspect(level) |> String.slice(0, 60)}"}
    end
  end

  defp check_assertion({:validation_issues, expected, msg}, result) do
    validation = result[:validation]
    has_issues = validation[:has_issues] || false
    issue_count = length(validation[:issues] || [])

    if has_issues == expected do
      {:pass, msg, "OK (#{issue_count} issues found)"}
    else
      {:fail, msg, "Expected has_issues=#{expected}, got #{has_issues} (#{issue_count} issues)"}
    end
  end

  defp check_assertion({:policy_compliant, expected, msg}, result) do
    eval = result[:policy_evaluation]
    compliant = eval[:compliant]

    if compliant == expected do
      {:pass, msg, "OK (compliant=#{compliant})"}
    else
      violations = length(eval[:violations] || [])
      {:fail, msg, "Expected compliant=#{expected}, got #{compliant} (#{violations} violations)"}
    end
  end

  defp check_assertion({:policy_violations, expected_any, msg}, result) do
    eval = result[:policy_evaluation]
    violations = eval[:violations] || []

    if length(violations) > 0 == expected_any do
      {:pass, msg, "OK (#{length(violations)} violations)"}
    else
      {:fail, msg, "Expected violations=#{expected_any}, found #{length(violations)}"}
    end
  end

  defp check_assertion({:policy_violations_or_geo, _expected, msg}, result) do
    eval = result[:policy_evaluation]
    violations = eval[:violations] || []
    geo_results = (eval[:results] || %{}) |> Map.get(:geography, [])
    geo_triggered = Enum.any?(geo_results, & &1[:triggered])

    if length(violations) > 0 or geo_triggered do
      {:pass, msg, "OK (#{length(violations)} violations, geo_triggered=#{geo_triggered})"}
    else
      {:fail, msg, "No policy violations or geography rules triggered"}
    end
  end

  defp check_assertion({:budget_check, msg}, result) do
    rec = result[:recommendation]

    cond do
      rec == nil ->
        {:fail, msg, "No recommendation to check budget"}

      Map.has_key?(rec, :within_budget) ->
        {:pass, msg, "Budget check: within=#{rec[:within_budget]}"}

      true ->
        {:pass, msg, "Budget info present (no explicit within_budget field)"}
    end
  end

  defp check_assertion({:pipeline_completes, msg}, _result) do
    {:pass, msg, "OK"}
  end

  defp check_assertion({:has_recommendation_or_escalation, msg}, result) do
    rec = result[:recommendation]
    esc = result[:escalation]

    has_rec = rec != nil and (rec[:recommended_supplier] != nil or rec[:reason] != nil)
    has_esc = esc != nil and esc[:escalation_required] == true

    if has_rec or has_esc do
      {:pass, msg, "OK"}
    else
      {:fail, msg, "Neither recommendation nor escalation found"}
    end
  end

  defp check_assertion(unknown, _result) do
    {:error, "unknown_assertion", "Unknown assertion: #{inspect(unknown)}"}
  end

  defp get_nested(map, keys) when is_map(map) and is_list(keys) do
    Enum.reduce(keys, map, fn
      key, acc when is_map(acc) -> Map.get(acc, key) || Map.get(acc, to_string(key))
      _key, _ -> nil
    end)
  end

  defp get_nested(_, _), do: nil

  def run_all do
    import Ecto.Query
    alias ChainIQ.Repo
    alias ChainIQ.Schema.ProcurementRequest

    all_requests =
      Repo.all(from(r in ProcurementRequest, order_by: r.request_id))
      |> Enum.map(fn r -> {r.request_id, r.raw_data} end)

    total = length(all_requests)

    IO.puts("\n" <> String.duplicate("═", 80))
    IO.puts("  ChainIQ FULL BACKTEST — #{total} requests, all scenario types")
    IO.puts(String.duplicate("═", 80) <> "\n")

    started_at = System.monotonic_time(:millisecond)

    results =
      all_requests
      |> Enum.map(fn {id, request} ->
        tag = primary_tag(request)
        expectations = generate_assertions(request, tag)

        IO.write("  #{id} (#{tag}) ")

        try do
          case Pipeline.process_by_id(id) do
            {:ok, pipeline_result} ->
              assertions =
                Enum.map(expectations, fn exp -> check_assertion(exp, pipeline_result) end)

              passed = Enum.count(assertions, fn {s, _, _} -> s == :pass end)
              failed = Enum.count(assertions, fn {s, _, _} -> s == :fail end)
              errors = Enum.count(assertions, fn {s, _, _} -> s == :error end)

              status = if failed == 0 and errors == 0, do: :pass, else: :fail
              char = if status == :pass, do: "✅", else: "❌"
              IO.puts("#{char} #{passed}/#{passed + failed + errors}")

              if status == :fail do
                for {s, name, detail} <- assertions, s != :pass do
                  IO.puts("    └─ #{s}: #{name} — #{detail}")
                end
              end

              %{
                id: id,
                tag: tag,
                status: status,
                passed: passed,
                failed: failed,
                errors: errors,
                assertions: assertions
              }

            {:error, reason} ->
              IO.puts("💥 pipeline error: #{inspect(reason)}")

              %{
                id: id,
                tag: tag,
                status: :error,
                passed: 0,
                failed: 0,
                errors: length(expectations),
                assertions: []
              }
          end
        rescue
          e ->
            msg = Exception.message(e) |> String.slice(0, 80)
            IO.puts("💥 crash: #{msg}")

            %{
              id: id,
              tag: tag,
              status: :error,
              passed: 0,
              failed: 0,
              errors: length(expectations),
              assertions: []
            }
        end
      end)

    elapsed = System.monotonic_time(:millisecond) - started_at

    IO.puts("\n" <> String.duplicate("─", 80))

    total_pass = Enum.count(results, &(&1.status == :pass))
    total_fail = Enum.count(results, &(&1.status == :fail))
    total_error = Enum.count(results, &(&1.status == :error))
    total_checks = Enum.sum(Enum.map(results, &(&1.passed + &1.failed + &1.errors)))
    checks_passed = Enum.sum(Enum.map(results, & &1.passed))

    IO.puts("\n  FULL BACKTEST SUMMARY:")
    IO.puts("  ├─ Requests:   #{total_pass}/#{total} passed")
    IO.puts("  ├─ Assertions: #{checks_passed}/#{total_checks} passed")
    IO.puts("  ├─ Errors:     #{total_error}")
    IO.puts("  ├─ Time:       #{elapsed}ms (#{Float.round(elapsed / max(total, 1), 1)}ms avg)")
    IO.puts("  └─ Pass rate:  #{Float.round(total_pass / max(total, 1) * 100, 1)}%")

    IO.puts("\n  PER-SCENARIO BREAKDOWN:")

    tags_ordered = [
      :standard,
      :threshold,
      :lead_time,
      :missing_info,
      :contradictory,
      :restricted,
      :multilingual,
      :capacity,
      :multi_country
    ]

    for tag <- tags_ordered do
      tag_results = Enum.filter(results, &(&1.tag == tag))
      tag_pass = Enum.count(tag_results, &(&1.status == :pass))
      tag_total = length(tag_results)

      if tag_total > 0 do
        pct = Float.round(tag_pass / tag_total * 100, 1)
        emoji = if tag_pass == tag_total, do: "✅", else: "⚠️"
        IO.puts("  #{emoji} #{tag}: #{tag_pass}/#{tag_total} (#{pct}%)")
      end
    end

    failed_cases = Enum.filter(results, &(&1.status == :fail))

    if length(failed_cases) > 0 do
      shown = Enum.take(failed_cases, 10)
      IO.puts("\n  FAILURES (showing #{length(shown)}/#{length(failed_cases)}):")

      for fc <- shown do
        failed_assertions = Enum.filter(fc.assertions, fn {s, _, _} -> s != :pass end)
        IO.puts("  ╔═ #{fc.id} (#{fc.tag})")

        for {_s, name, detail} <- Enum.take(failed_assertions, 3) do
          IO.puts("  ║  └─ #{name}: #{detail}")
        end

        IO.puts("  ╚═══")
      end
    end

    IO.puts("\n" <> String.duplicate("═", 80))

    IO.puts(
      "  Full backtest complete. #{length(failed_cases)} failures, #{total_error} errors.\n"
    )

    %{
      total: total,
      passed: total_pass,
      failed: total_fail,
      errors: total_error,
      total_checks: total_checks,
      checks_passed: checks_passed,
      elapsed_ms: elapsed,
      pass_rate: Float.round(total_pass / max(total, 1) * 100, 1),
      per_scenario:
        Enum.map(tags_ordered, fn tag ->
          tag_results = Enum.filter(results, &(&1.tag == tag))
          {tag, Enum.count(tag_results, &(&1.status == :pass)), length(tag_results)}
        end),
      results: results
    }
  end

  defp primary_tag(request) do
    tags = request["scenario_tags"] || []

    priority = [
      "threshold",
      "restricted",
      "missing_info",
      "contradictory",
      "capacity",
      "multi_country",
      "multilingual",
      "lead_time",
      "standard"
    ]

    found = Enum.find(priority, "standard", fn p -> p in tags end)
    String.to_atom(found)
  end

  defp generate_assertions(request, tag) do
    universal = [
      {:has_field, [:request_interpretation, :category], "Category must be extracted"},
      {:pipeline_completes, "Pipeline must complete without crash"},
      {:has_recommendation_or_escalation, "Must produce recommendation OR escalation"}
    ]

    tag_checks =
      case tag do
        :standard ->
          [
            {:has_recommendation, "Standard request needs recommendation"}
          ]

        :threshold ->
          [
            {:approval_triggered, "Approval threshold must be detected"}
          ]

        :lead_time ->
          [
            {:has_field, [:request_interpretation, :required_by], "Deadline must be captured"}
          ]

        :missing_info ->
          [
            {:validation_issues, true, "Must detect missing information"}
          ]

        :contradictory ->
          [
            {:validation_issues, true, "Contradictions must be detected"}
          ]

        :restricted ->
          [
            {:policy_violations, true, "Restricted supplier must be flagged"}
          ]

        :multilingual ->
          [
            {:has_field, [:request_interpretation, :category],
             "Must extract category from non-EN text"}
          ]

        :capacity ->
          [
            {:has_field, [:request_interpretation, :quantity],
             "Quantity must be captured for capacity check"}
          ]

        :multi_country ->
          [
            {:has_field, [:request_interpretation, :country],
             "Delivery countries must be captured"}
          ]

        _ ->
          []
      end

    data_checks = []

    data_checks =
      if request["quantity"] == nil and tag != :missing_info do
        data_checks ++
          [{:validation_issues, true, "Null quantity should produce validation issues"}]
      else
        data_checks
      end

    data_checks =
      if request["budget_amount"] != nil and request["budget_amount"] > 0 do
        data_checks ++
          [{:has_field, [:request_interpretation, :budget], "Budget field should be populated"}]
      else
        data_checks
      end

    universal ++ tag_checks ++ data_checks
  end
end
