class QuizAnswer < ApplicationRecord
  belongs_to :quiz_run
  belongs_to :quiz_question
end
