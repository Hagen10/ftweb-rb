class CreateQuizQuestions < ActiveRecord::Migration[8.1]
  def change
    create_table :quiz_questions do |t|
      t.integer :voting_session_id
      t.string :title
      t.string :title_short
      t.text :summary
      t.integer :position

      t.timestamps
    end
  end
end
