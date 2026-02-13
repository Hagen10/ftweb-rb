# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_02_12_094301) do
  create_table "quiz_answers", force: :cascade do |t|
    t.string "choice"
    t.datetime "created_at", null: false
    t.integer "quiz_question_id", null: false
    t.integer "quiz_run_id", null: false
    t.datetime "updated_at", null: false
    t.index ["quiz_question_id"], name: "index_quiz_answers_on_quiz_question_id"
    t.index ["quiz_run_id"], name: "index_quiz_answers_on_quiz_run_id"
  end

  create_table "quiz_questions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.integer "position"
    t.text "summary"
    t.string "title"
    t.string "title_short"
    t.datetime "updated_at", null: false
    t.integer "voting_session_id"
  end

  create_table "quiz_runs", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.integer "current_index"
    t.datetime "updated_at", null: false
    t.string "user"
  end

  add_foreign_key "quiz_answers", "quiz_questions"
  add_foreign_key "quiz_answers", "quiz_runs"
end
