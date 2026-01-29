class PoliticianController < ApplicationController
  def index
    client = ApiClient.new

    @politicians = client.politicians
  end

  def show
    client = ApiClient.new

    @politician_info = client.politician_info(params[:id])

    @politician_votes = client.politician_votes(params[:id])
  end
end
