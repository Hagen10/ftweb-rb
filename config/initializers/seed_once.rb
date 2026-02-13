Rails.application.config.after_initialize do
  # Prevent running in console, rake, etc.
  next unless defined?(Rails::Server)

  # Only run if table is empty
  if QuizQuestion.count.zero?
    puts "Seeding database..."

    client = ApiClient.new
    client.prepare_quiz_questions

    puts "Done seeding database!"
  end
end
