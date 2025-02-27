import { Component, OnInit, Input, ViewEncapsulation } from '@angular/core';
import { ViewModel, ViewModelsService } from '../viewmodels.service';
import { BaseStix, DataService, Group, Mitigation, Software, Technique } from '../data.service';

@Component({
  selector: 'app-search-and-multiselect',
  templateUrl: './search-and-multiselect.component.html',
  styleUrls: ['./search-and-multiselect.component.scss'],
  encapsulation: ViewEncapsulation.None
})

export class SearchAndMultiselectComponent implements OnInit {
    @Input() viewModel: ViewModel;
    public stixTypes: any[];
    userClickedExpand = false;
    expandedPanels = {
        0: true,
        1: false,
        2: false,
        3: false
    };

    public fields = [
        {
            "label": "name",
            "field": "name",
            "enabled": true
        },
        {
            "label": "ATT&CK ID",
            "field": "attackID",
            "enabled": true
        },
        // {
        //     "label": "STIX ID",
        //     "field": "id",
        //     "enabled": false
        // },
        {
            "label": "description",
            "field": "description",
            "enabled": true
        },
        {
            "label": "data sources",
            "field": "datasources",
            "enabled": true
        }
    ]

    private debounceFunction;
    private previousQuery: string = "";
    private _query: string = "";
    public set query(newQuery: string) {
        this._query = newQuery;
        if (!this.debounceFunction) {
            this.debounceFunction = setTimeout(() => {
                this.getResults(this._query);
                this.debounceFunction = null;
                this.previousQuery = this._query;
                }, 300);
        }
    }

    public get queryLength(): number {
        return this._query.length;
    }

    public techniqueResults: Technique[] = [];

    constructor(private dataService: DataService, private viewModelsService: ViewModelsService) {
        this.stixTypes = [];
    }

    ngOnInit() {
        this.getResults();
    }

    /**
     * filterAndSort() takes an array of items and does the following:
     *       1) if the query is empty, then it sorts the array
     *       2) if the query is not empty, then it filters the already sorted array until nothing is left, or until
     *          the query is cleared out and empty again
     * @param items BaseStix[] or Technique[] objects to be filtered and sorted
     * @param query user-input query in search bar
     * @param sortTechniquesAndSubtechniques will be true if called from getTechniqueResults(),
     *                                       to sort techniques and all its subtechniques,
     *                                       otherwise just sort BaseStix items by name
     */
    filterAndSort(items: BaseStix[], query = "", sortTechniquesAndSubtechniques = false): any[] {
        let self = this;
        let results = items.filter(t => !t.deprecated && !t.revoked);
        if (query.trim() === "") {
            if (sortTechniquesAndSubtechniques) {
                results.sort((tA: Technique, tB: Technique) => {
                    let c1 = tA.isSubtechnique ? tA.parent.name : tA.name;
                    let c2 = tB.isSubtechnique ? tB.parent.name : tB.name;
                    return c1.localeCompare(c2)
                });
            } else {
                results.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
            }
        } else {
            // deconflict IDs for cross-tactic techniques
            let seenIDs = new Set();
            results = results.filter(function (technique: Technique) {
                if (seenIDs.has(technique.id)) return false;
                for (let field of self.fields) {
                    if (field.enabled) {
                        // query in this field
                        if (technique[field.field]?.toLowerCase().includes(query.trim().toLowerCase())) {
                            seenIDs.add(technique.id);
                            return true;
                        }
                    }
                }
                return false;
            });
        }
        return results;
    }


    /**
     * getResults() checks if this._query is:
     *       1) valid, and
     *       2) part of last query, otherwise call getTechniques() and getStixData() to search all objects again
    **/

    getResults(query = "", fieldToggled = false) {
        if (query.trim() != "" && query.includes(this.previousQuery) && !fieldToggled) {
            this.techniqueResults = this.filterAndSort(this.techniqueResults, query, true);
            this.stixTypes.forEach(item => item['objects'] = this.filterAndSort(item['objects'], query));
        } else {
            this.getTechniques();
            this.getStixData();
        }
        this.expandPanels();
    }

    expandPanels() {
        if (!this.userClickedExpand) {
            this.expandedPanels[0] = this.techniqueResults.length > 0;
            let isPrevExpanded = this.expandedPanels[0]
            if (!isPrevExpanded) {
                this.stixTypes.forEach((s, i) => {
                    s.isExpanded = !isPrevExpanded && s.objects.length > 0;
                    this.expandedPanels[i+1] = s.isExpanded;
                    isPrevExpanded = s.isExpanded;
                });
            }
        } else {
            let isAllCollapsed = false;
            for (const item in this.expandedPanels) {
                isAllCollapsed = !item;
            }
            this.userClickedExpand = isAllCollapsed;
        }
    }

    getTechniques() {
        //get master list of techniques and sub-techniques
        let allTechniques = this.dataService.getDomain(this.viewModel.domainVersionID).techniques;
        for (let technique of allTechniques) {
            allTechniques = allTechniques.concat(technique.subtechniques);
        }
        this.techniqueResults = this.filterAndSort(allTechniques, this._query, true);
    }

    getStixData() {
        let domain = this.dataService.getDomain(this.viewModel.domainVersionID);

        this.stixTypes = [{
            "label": "threat groups",
            "objects": this.filterAndSort(domain.groups, this._query),
            "isExpanded": false
        }, {
            "label": "software",
            "objects": this.filterAndSort(domain.software, this._query),
            "isExpanded": false
        }, {
            "label": "mitigations",
            "objects": this.filterAndSort(domain.mitigations, this._query),
            "isExpanded": false
        }]
    }

    public toggleFieldEnabled(field: string) {
        for (let thefield of this.fields) {
            if (thefield.field == field) {
                thefield.enabled = !thefield.enabled;
                // set query to empty string to trigger getResults() in the case that:
                // 1) a field was toggled, and
                // 2) the query did not change
                this.getResults("", true);
                break;
            }
        }
    }

    public mouseEnter(technique: Technique, isTechnique = true): void {
        if (!isTechnique) {
            for (let t of this.getRelated(technique)) {
                this.viewModel.selectTechniqueAcrossTactics(t, true, true);
            }
        } else {
            this.viewModel.highlightTechnique(technique);
        }
    }

    public mouseLeave(): void {
        this.viewModel.clearHighlight();
    }

    public select(stixObject: any, isTechnique= true): void {
        if (isTechnique) {
            this.viewModel.selectTechniqueAcrossTactics(stixObject);
        }
        else if (!isTechnique) {
            for (let technique of this.getRelated(stixObject)) {
                this.viewModel.selectTechniqueAcrossTactics(technique);
            }
        }
        this.viewModelsService.onSelectionChange.emit(); // emit selection change
    }

    public deselect(stixObject: any, isTechnique = true): void {
        if (isTechnique) {
            this.viewModel.unselectTechniqueAcrossTactics(stixObject);
        }
        else if (!isTechnique) {
            for (let technique of this.getRelated(stixObject)) {
                this.viewModel.unselectTechniqueAcrossTactics(technique);
            }
        }
        this.viewModelsService.onSelectionChange.emit(); // emit selection change
    }

    public selectAll(items: any[], isTechniqueArray = true): void {
        if (isTechniqueArray) {
            for (let result of items) this.select(result, isTechniqueArray);
        }
        else if (!isTechniqueArray) {
            for (let stixObject of items) this.select(stixObject, isTechniqueArray);
        }
        this.viewModelsService.onSelectionChange.emit(); // emit selection change
    }

    public deselectAll(items: any[], isTechniqueArray = true): void {
        if (isTechniqueArray) {
            for (let result of items) this.deselect(result, isTechniqueArray);
        }
        else if (!isTechniqueArray) {
            for (let stixObject of items) this.deselect(stixObject, isTechniqueArray);
        }
        this.viewModelsService.onSelectionChange.emit(); // emit selection change
    }

    public getRelated(stixObject: BaseStix): Technique[] {
        // master list of all techniques and sub-techniques
        let techniques = this.dataService.getDomain(this.viewModel.domainVersionID).techniques;
        let allTechniques = techniques.concat(this.dataService.getDomain(this.viewModel.domainVersionID).subtechniques);
        let domainVersionID = this.viewModel.domainVersionID;

        if (stixObject instanceof Group) {
            return allTechniques.filter((technique: Technique) => (stixObject as Group).relatedTechniques(domainVersionID).includes(technique.id));
        } else if (stixObject instanceof Software) {
            return allTechniques.filter((technique: Technique) => (stixObject as Software).relatedTechniques(domainVersionID).includes(technique.id));
        } else if (stixObject instanceof Mitigation) {
            return allTechniques.filter((technique: Technique) => (stixObject as Mitigation).relatedTechniques(domainVersionID).includes(technique.id));
        }
    }
}
