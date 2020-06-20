import { Component, OnInit, ViewChild } from '@angular/core';
import { Observable, combineLatest, iif, of } from 'rxjs';
import { startWith, tap, map, share, switchMap, take } from 'rxjs/operators';
import { FormBuilder, FormControl } from '@angular/forms';
import * as XLSX from 'xlsx';


import { DatabaseService } from 'src/app/core/services/database.service';
import { AuthService } from 'src/app/core/services/auth.service';

import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';

import { Product } from 'src/app/core/models/product.model';
import { ProductCreateEditComponent } from './product-create-edit/product-create-edit.component';
import { ProductEditPromoComponent } from './product-edit-promo/product-edit-promo.component';
import { ConfirmationDialogComponent } from '../confirmation-dialog/confirmation-dialog.component';
@Component({
  selector: 'app-products-list',
  templateUrl: './products-list.component.html',
  styleUrls: ['./products-list.component.scss']
})
export class ProductsListComponent implements OnInit {
  //Forms
  categoryForm: FormControl;
  itemsFilterForm: FormControl;
  promoFilterForm: FormControl;

  //Table
  productsTableDataSource = new MatTableDataSource<Product>();
  productsDisplayedColumns: string[] = [
    'index', 'photoURL', 'description', 'sku', 'category', 'price', 
    'unitDescription', 'unitAbbreviation', 'unitWeight', 'sellMinimum', 'alertMinimum', 
    'realStock', 'mermaStock', 'virtualStock', 'published', 'actions'
  ]

  productsObservable$: Observable<Product[]>
  @ViewChild('productsPaginator', { static: false }) set content(paginator1: MatPaginator) {
    this.productsTableDataSource.paginator = paginator1;
  }

  //Observables
  categoryObservable$: Observable<[any, string[]]>
  categoryList$: Observable<string[]>
  filter$: Observable<boolean>


  //Variables
  defaultImage = "../../../assets/images/default-image.jpg";

  //noResult
  noResult$: Observable<string>;
  noResultImage: string = ''

  constructor(
    private fb: FormBuilder,
    private dialog: MatDialog,
    public snackBar: MatSnackBar,
    private dbs: DatabaseService,
    public auth: AuthService
  ) { }

  ngOnInit(): void {
    this.initForms();
    this.initObservables();
  }

  initForms() {
    this.categoryForm = this.fb.control("");
    this.itemsFilterForm = this.fb.control("");
    this.promoFilterForm = this.fb.control(false);
  }

  initObservables() {
    this.productsTableDataSource.filterPredicate =
      (data: Product, filter: string) => {
        let category = filter.trim().split('&+&')[0];   //category
        let name = filter.trim().split('&+&')[1];       //product name
        let promo = filter.trim().split('&+&')[2];                    //promo
        return (data.category.match(new RegExp(category,'ig'))
          && data.description.match(new RegExp(name, 'ig'))
          && (String(data.promo) == promo || promo == "false"))
      }

    this.categoryObservable$ = combineLatest(
      this.categoryForm.valueChanges.pipe(startWith('')), 
      this.dbs.getProductsListCategoriesValueChanges()
      ).pipe(share());

    this.categoryList$ = this.categoryObservable$.pipe(map(([formValue, categories]) => {
      let filter = categories.filter(el => el.match(new RegExp(formValue,'ig')));
      if (!(filter.length == 1 && filter[0] === formValue) && formValue.length) {
        this.categoryForm.setErrors({ invalid: true });
      }
      return filter;
    }));

    this.filter$ = combineLatest(
      this.categoryObservable$,
      this.itemsFilterForm.valueChanges.pipe(startWith('')),
      this.promoFilterForm.valueChanges.pipe(startWith(false)))
      .pipe(
        map(([[categoryFormValue, categories], itemsFormValue, promoFormValue]) => {
          this.productsTableDataSource.filter = categoryFormValue + '&+&' + itemsFormValue + '&+&' + promoFormValue;
          return true
        })
      )

    this.productsObservable$ = this.dbs.getProductsListValueChanges().pipe(
      tap(res => {
        this.productsTableDataSource.data = res.map(el => {
          el['virtualStock$'] = this.dbs.getVirtualStock(el).pipe(
            map(prod => prod.reduce((a,b)=> a+b.quantity, 0))
          );
          return el
        })
      })
    )
  }

  onPublish(product: Product, publish: boolean) {
    let prod = product;
    prod.published = publish;
    this.dbs.publishProduct(true, prod, null).commit().then(
      res => {
        this.snackBar.open('Producto editado satisfactoriamente.', 'Aceptar');
      },
      err => {
        this.snackBar.open('Ocurrió un error. Vuelva a intentarlo.', 'Aceptar');
      }
    )

  }

  onDeleteItem(product: Product) {
    let dialogRef: MatDialogRef<ConfirmationDialogComponent>;
    dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      closeOnNavigation: true,
      disableClose: true,
      width: '360px',
      maxWidth: '360px',      
      data: {
      warning: `El producto será borrado.`,
      content: `¿Está seguro de borrar el producto ${product.description}?`,
      noObservation: true,
      observation: null,
      title: 'Borrar',
      titleIcon: 'done_all'
      }
    })

    dialogRef.afterClosed().pipe(
      take(1),
      switchMap((answer: {action: string, lastObservation: string}) => 
        iif(
          () => {return answer.action =="confirm"},
          this.dbs.deleteProduct(product),
          of(answer)
          )
      ))
      .subscribe((answer: {action: string, lastObservation: string} | firebase.firestore.WriteBatch) => {
        if((<Object>answer).hasOwnProperty("action")){
          //We don't do anything, as the action was cancelled,
        }
        else{
          (<firebase.firestore.WriteBatch>answer).commit().then(
            res => {
              this.snackBar.open('Producto eliminado satisfactoriamente.', 'Aceptar');
            },
            err => {
              this.snackBar.open('Ocurrió un error. Vuelva a intentarlo.', 'Aceptar');
            }
          )
        }
      },
      err => {
        this.snackBar.open('Ocurrió un error. Vuelva a intentarlo.', 'Aceptar');
      })

  }

  onPromo(product: Product) {
    let dialogRef: MatDialogRef<ProductEditPromoComponent>;
    dialogRef = this.dialog.open(ProductEditPromoComponent, {
      width: '350px',
      data: {
        data: product,
      }
    });
    dialogRef.afterClosed().subscribe(res => {
      switch (res) {
        case true:
          this.snackBar.open('El producto fue editado satisfactoriamente', 'Aceptar', { duration: 5000 });
          break;
        case false:
          this.snackBar.open('Ocurrió un error. Por favor, vuelva a intentarlo', 'Aceptar', { duration: 5000 });
          break;
        default:
          break;
      }
    })
  }

  onCreateEditItem(edit: boolean, product?: Product) {
    let dialogRef: MatDialogRef<ProductCreateEditComponent>;
    if (edit == true) {
      dialogRef = this.dialog.open(ProductCreateEditComponent, {
        width: '350px',
        data: {
          data: product,
          edit: edit
        }
      });
      dialogRef.afterClosed().subscribe(res => {
        switch (res) {
          case true:
            this.snackBar.open('El producto fue editado satisfactoriamente', 'Aceptar', { duration: 5000 });
            break;
          case false:
            this.snackBar.open('Ocurrió un error. Por favor, vuelva a intentarlo', 'Aceptar', { duration: 5000 });
            break;
          default:
            break;
        }
      })
    }
    else {
      dialogRef = this.dialog.open(ProductCreateEditComponent, {
        width: '350px',
        data: {
          data: null,
          edit: edit
        }
      });
      dialogRef.afterClosed().subscribe(res => {
        switch (res) {
          case true:
            this.snackBar.open('El nuevo producto fue creado satisfactoriamente', 'Aceptar', { duration: 5000 });
            break;
          case false:
            this.snackBar.open('Ocurrió un error. Por favor, vuelva a intentarlo', 'Aceptar', { duration: 5000 });
            break;
          default:
            break;
        }
      })
    }
  }

  downloadXls(): void {
    let table_xlsx: any[] = [];
    let headersXlsx = [
      'Descripcion', 'SKU', 'Categoría', 'Precio', 
      'Descripción de Unidad', 'Abreviación', 'Peso (KG)', 'Stock Real', 'Mínimo de venta', 'Mínimio de alerta', 
      'Stock de merma', 'Stock Virtual', 'Publicado'
    ]

    table_xlsx.push(headersXlsx);

    this.productsTableDataSource.filteredData.forEach(product => {
      const temp = [
       product.description, 
       product.sku, 
       product.category, 
       "S/." +product.price,
       product.unit.description,
       product.unit.abbreviation,
       product.unit.weight, 
       product.realStock, 
       product.sellMinimum, 
       product.alertMinimum,  
       product.mermaStock, 
       0, //virtualStock
       product.published ? "Sí":"No"
      ];

      table_xlsx.push(temp);
    })

    /* generate worksheet */
    const ws: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(table_xlsx);

    /* generate workbook and add the worksheet */
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lista_de_productos');

    /* save to file */
    const name = 'Lista_de_productos' + '.xlsx';
    XLSX.writeFile(wb, name);
  }
}
