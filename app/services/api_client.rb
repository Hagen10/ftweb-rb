class ApiClient
  BASE_URL = ENV.fetch("KOTLIN_API_URL") { "http://localhost:8080" }

  def initialize
    @connection ||= Faraday.new(url: BASE_URL) do |f|
      f.request :json
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

  def prepare_quiz_questions
    response = @connection.get("/api/quiz")

    raise "API error" unless response.success?

    data = response.body

    # Creating an entry for each question once! (if they already exist,
    # nothing happens)
    data.each do |item|
      QuizQuestion.find_or_create_by!(voting_session_id: item["id"], 
                                      title: item["title"], 
                                      title_short: item["titleShort"], 
                                      summary: item["resume"])
    end
  end

  def finish_quiz(answer_list)
    response = @connection.post("/api/quiz/finish", answer_list,
      "Content-Type" => "application/json")

    raise "API error" unless response.success?

    response.body
  end
end
