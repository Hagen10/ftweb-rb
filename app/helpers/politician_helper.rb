module PoliticianHelper
  # Approximate party-color mapping for major Danish parties.
  # Used by the discourse-consistency timelines so each politician's line
  # matches their party colour. Falls back to a neutral grey.
  PARTY_COLORS = {
    "A"   => "#A82721",  # Socialdemokratiet
    "S"   => "#A82721",
    "V"   => "#0B4F8C",  # Venstre
    "K"   => "#7B9F4D",  # Konservative
    "KF"  => "#7B9F4D",
    "DF"  => "#EAC73E",  # Dansk Folkeparti
    "SF"  => "#E07EA8",  # Socialistisk Folkeparti
    "RV"  => "#733280",  # Radikale Venstre
    "EL"  => "#E6332A",  # Enhedslisten
    "ALT" => "#2B8C5D",  # Alternativet
    "M"   => "#512B7C",  # Moderaterne
    "NB"  => "#127B7F",  # Nye Borgerlige
    "LA"  => "#12830B",  # Liberal Alliance
    "DD"  => "#003E5C",  # Danmarksdemokraterne
    "IA"  => "#E6332A",
    "JF"  => "#A82721",
    "SP"  => "#7B9F4D",
    "FG"  => "#E07EA8",
    "T"   => "#7B7B7B",
    "UFG" => "#7B7B7B"
  }.freeze

  DEFAULT_PARTY_COLOR = "#7B7B7B".freeze

  def party_color(party_short)
    PARTY_COLORS[party_short.to_s.upcase] || DEFAULT_PARTY_COLOR
  end
end
