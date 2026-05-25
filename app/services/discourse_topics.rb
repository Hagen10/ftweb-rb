require "yaml"

# Loads the list of "important political topics" used by the
# Discourse Consistency tab from config/discourse_topics.yml.
# Parsed once per process and memoised.
class DiscourseTopics
  Topic = Struct.new(:label, :stance_subject, keyword_init: true) do
    def slug
      label.parameterize
    end

    # NLI subject; defaults to label when YAML omits it.
    def subject
      (stance_subject.presence || label).to_s
    end
  end

  CONFIG_PATH = Rails.root.join("config", "discourse_topics.yml")

  class << self
    def all
      @all ||= load_from_file
    end

    # For tests / reloading.
    def reset!
      @all = nil
    end

    private

    def load_from_file
      data = YAML.safe_load_file(CONFIG_PATH) || {}
      (data["topics"] || []).map do |entry|
        Topic.new(label: entry["label"], stance_subject: entry["stance_subject"])
      end
    end
  end
end
