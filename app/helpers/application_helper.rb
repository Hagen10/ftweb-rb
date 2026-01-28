module ApplicationHelper
  def approved_rejected(value)
      value ? "Vedtaget" : "Forkastet"
  end
end
