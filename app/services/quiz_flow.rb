class QuizFlow
  def self.start(user = nil)
    QuizRun.create!(user: user, current_index: QuizQuestion.first.id)
  end

  def self.current_question(quiz_run)
    QuizQuestion.find_by(id: quiz_run.current_index)
  end

  def self.answer!(quiz_run, choice)
    QuizAnswer.create!(quiz_run: quiz_run, 
                       quiz_question: current_question(quiz_run), 
                       choice: choice)

    quiz_run.increment!(:current_index)
  end

  def self.finished?(quiz_run)
    quiz_run.current_index >= QuizQuestion.last.id
  end
end
