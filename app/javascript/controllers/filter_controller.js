import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = [
    "body",
    "search",
    "data"
  ]

  static values = {
    items: Array
  }

  connect() {
    this.items = JSON.parse(
    this.dataTarget.textContent
  )

    this.filteredItems = [...this.items]

    this.sortColumn = null
    this.sortDirection = "asc"

    this.render()
  }


// Not working currently. But could perhaps be used for filtering
// On the speakers shown on the list or something...
//   filter() {
//     const search = this.searchTarget.value.toLowerCase()

//     this.filteredItems = this.itemsValue.filter(item => {
//       const matchesSearch =
//         item.speaker_name_s.toLowerCase().includes(search)

//     return matchesSearch
//     })

//     this.applySort()

//     this.render()
//   }

  sort(event) {
    const column = event.currentTarget.dataset.column

    if (this.sortColumn === column) {
      this.sortDirection =
        this.sortDirection === "asc"
          ? "desc"
          : "asc"
    } else {
      this.sortColumn = column
      this.sortDirection = "asc"
    }

    this.applySort()
    this.render()
  }

  applySort() {
    if (!this.sortColumn) return

    this.filteredItems.sort((a, b) => {
      let aValue = a[this.sortColumn]
      let bValue = b[this.sortColumn]

      // date handling
      if (this.sortColumn === "start_dt") {
        aValue = new Date(aValue)
        bValue = new Date(bValue)
      }

      if (aValue < bValue)
        return this.sortDirection === "asc" ? -1 : 1

      if (aValue > bValue)
        return this.sortDirection === "asc" ? 1 : -1

      return 0
    })
  }

  render() {
    this.bodyTarget.innerHTML = this.filteredItems
      .map(item => 
      {const date = item.start_dt
          ? new Date(item.start_dt).toLocaleDateString("da-DK")
          : ""

        return `
        <tr>
          <td>${item.speaker_name_s}</td>
          <td>${date}</td>
          <td>${item.text_t}</td>
        </tr>
        `
      })
      .join("")
  }
}