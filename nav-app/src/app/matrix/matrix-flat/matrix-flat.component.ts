import { Component, OnInit } from '@angular/core';
import { MatrixCommon } from '../matrix-common';
import { ConfigService } from '../../config.service';
import { ViewModelsService } from '../../viewmodels.service';

@Component({
  selector: 'matrix-flat',
  templateUrl: './matrix-flat.component.html',
  styleUrls: ['./matrix-flat.component.scss']
})
export class MatrixFlatComponent extends MatrixCommon implements OnInit  {

    constructor(configService: ConfigService, viewModelsService: ViewModelsService) { 
        super(configService, viewModelsService);
    }

    ngOnInit() {}
}
