class ApiClient
  BASE_URL = "http://localhost:8080" # ENV.fetch("KOTLIN_API_URL")

  def initialize
    @connection ||= Faraday.new(url: BASE_URL) do |f|
      f.response :json
      f.response :raise_error
      f.adapter Faraday.default_adapter
    end
  end

  def politicians
    response = @connection.get("/api/politicians")

    raise "API error" unless response.success?

    response.body
  end

  def politician_info(id)
    response = @connection.get("/api/politicianInfo/#{id}")

    raise "API error" unless response.success?

    response.body
  end

  def politician_votes(id)
    response = @connection.get("/api/politicianVotes/#{id}")

    raise "API error" unless response.success?

    response.body
  end
end
