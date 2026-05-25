class VectorApiClient
  BASE_URL = ENV.fetch("VECTOR_API_URL") { "http://localhost:8000" }

  def initialize
    @connection ||= Faraday.new(url: BASE_URL) do |f|
      f.request :json
      f.response :json
      f.response :raise_error
      f.adapter Faraday.default_adapter
    end
  end

  def search(search_query)
    response = @connection.post("/search",
        { "query": search_query }, "Content-Type" => "application/json")

    raise "API error" unless response.success?

    response.body
  end

  # Cosine similarity between `query` and every indexed speech segment by
  # `speaker`. Returns docs sorted chronologically with a `similarity` field
  # in [-1, 1] suitable for plotting on a timeline.
  def politician_timeline(speaker:, query:, stance_subject: nil, date_from: nil, date_to: nil)
    body = { speaker: speaker, query: query, include_stance: true }
    body[:stance_subject] = stance_subject if stance_subject
    body[:date_from] = date_from if date_from
    body[:date_to]   = date_to   if date_to

    response = @connection.post("/politician_timeline", body,
      "Content-Type" => "application/json")

    raise "API error" unless response.success?

    response.body
  end

  # Most-similar and most-different speech segments to a given doc.
  def nearest_speeches(doc_id:, top_k: 5)
    response = @connection.post("/nearest_speeches",
      { doc_id: doc_id, top_k: top_k },
      "Content-Type" => "application/json")

    raise "API error" unless response.success?

    response.body
  end
end
