class PoliticianController < ApplicationController
  before_action :load_politician_info, only: [ :show, :discourse,
                                               :discourse_timeline,
                                               :nearest_speeches ]

  def index
    client = ApiClient.new

    @politicians = client.politicians
  end

  def show
    client = ApiClient.new

    @politician_votes = client.politician_votes(params[:id])
    @active_tab = :votes
  end

  def discourse
    @topics = DiscourseTopics.all
    @active_tab = :discourse
  end

  # AJAX: returns cosine-similarity timeline for a single topic.
  # Used both for the predefined topics and the free-text search row.
  def discourse_timeline
    query = params[:query].to_s.strip
    return render(json: { error: "missing query" }, status: :bad_request) if query.empty?

    stance_subject = params[:stance_subject].to_s.strip
    stance_subject = query if stance_subject.empty?

    results = VectorApiClient.new.politician_timeline(
      speaker: politician_full_name,
      query: query,
      stance_subject: stance_subject
    )
    render json: results
  end

  # AJAX: most-similar / most-different speeches across other politicians
  # for a given speech segment (when the user clicks a point on a timeline).
  def nearest_speeches
    doc_id = params[:doc_id].to_s
    return render(json: { error: "missing doc_id" }, status: :bad_request) if doc_id.empty?

    results = VectorApiClient.new.nearest_speeches(doc_id: doc_id)
    render json: results
  end

  private

  def load_politician_info
    @politician_info = ApiClient.new.politician_info(params[:id])
  end

  def politician_full_name
    "#{@politician_info['firstName']} #{@politician_info['lastName']}".strip
  end
end
