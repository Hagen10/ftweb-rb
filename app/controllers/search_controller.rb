class SearchController < ApplicationController
    def index
        # client = VectorApiClient.new
        @query = params[:q]

        return unless @query.present?

        client = VectorApiClient.new
        @results = client.search(@query)

        puts "RESULTS: #{@results}"
    end
end
