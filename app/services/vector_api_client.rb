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
        {"query": search_query}, "Content-Type" => "application/json")

    raise "API error" unless response.success?

    response.body
  end
end