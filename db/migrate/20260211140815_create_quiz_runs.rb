class CreateQuizRuns < ActiveRecord::Migration[8.1]
  def change
    create_table :quiz_runs do |t|
      t.references :user, null: false, foreign_key: true
      t.integer :current_index

      t.timestamps
    end
  end
end
