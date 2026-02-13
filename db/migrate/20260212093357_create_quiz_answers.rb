class CreateQuizAnswers < ActiveRecord::Migration[8.1]
  def change
    create_table :quiz_answers do |t|
      t.references :quiz_run, null: false, foreign_key: true
      t.references :quiz_question, null: false, foreign_key: true
      t.string :choice

      t.timestamps
    end
  end
end
