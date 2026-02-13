class QuizController < ApplicationController
  def index
    quiz_run = current_quiz_run || QuizFlow.start(current_user)
    session[:quiz_run_id] = quiz_run.id

    @question = QuizFlow.current_question(quiz_run)
  end

  def answer
    quiz_run = current_quiz_run

    QuizFlow.answer!(quiz_run, params[:choice])

    puts "Answered question"
    puts quiz_run

    if QuizFlow.finished?(quiz_run)
      puts "Quiz Finished"
      redirect_to "/quiz/finish"
    else
      puts "Quiz not finished yet"
      redirect_to quiz_path
    end
  end

  def finish
    results = QuizAnswer.where(quiz_run_id: current_quiz_run)

    results.as_json(only: [ :test_id, :user_name ])

    votes= results.pluck(:quiz_question_id, :choice).map do |quiz_question_id, choice |
      { caseId: QuizQuestion.find(quiz_question_id).voting_session_id, vote: choice }
    end

    client = ApiClient.new

    @voting_results = client.finish_quiz(votes)

    puts "Cleaning up Quiz results!"

    # Removing the questions that were given and resetting the quiz run
    QuizAnswer.where(quiz_run_id: current_quiz_run).destroy_all
    QuizRun.where(user: current_user).destroy_all
    quiz_run = nil
    session[:quiz_run_id] = nil
  end

  private

  def current_quiz_run
    QuizRun.find_by(id: session[:quiz_run_id])
  end
end
