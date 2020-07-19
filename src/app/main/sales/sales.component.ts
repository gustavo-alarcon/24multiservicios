import { Component, OnInit } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Sale, SaleRequestedProducts } from 'src/app/core/models/sale.model';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-sales',
  templateUrl: './sales.component.html',
  styleUrls: ['./sales.component.scss']
})
export class SalesComponent implements OnInit {
  detailSubject: BehaviorSubject<Sale> = new BehaviorSubject(null)
  locationSubject: BehaviorSubject<number>= new BehaviorSubject(0)
  detail$: Observable<Sale> = this.detailSubject.asObservable();

  locationPadding$: Observable<string>;

  totalPriceSubj: BehaviorSubject<number> = new BehaviorSubject(0)
  constructor() { }

  ngOnInit(): void {
    this.locationPadding$ = this.locationSubject.asObservable().pipe(
      map(location => {
        let x = 180+180*location;
        if(location > 1){
          return x.toFixed(0)+"px"
        } else {
          return "32px"
        }
      })
    )
  }

  back(){
    this.detailSubject.next(null);
  }

  givePrice(item: SaleRequestedProducts): number {
    let amount = item['quantity']
    let price = item['product']['price']
    if(item.product.promo){
      let promo = item['product']['promoData']['quantity']
      let pricePromo = item['product']['promoData']['promoPrice']
  
      if (amount >= promo) {
        let wp = amount % promo
        let op = Math.floor(amount / promo)
        return wp * price + op * pricePromo
      } else {
        return amount * price
      }
    } else {
      return amount * price
    }
  }
  giveTotalPrice(sale: Sale): number{
    return sale.requestedProducts.reduce((a,b) => a + this.givePrice(b), 0)
  }
  locationPadding(location: number): string{
    console.log(location);
    let x = 112+180*location;
    if(location > 2){
      return x.toFixed(0)+" !important"
    } else {
      return "32px"
    }
  }

}
