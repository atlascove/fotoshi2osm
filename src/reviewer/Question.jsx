/* Adapted from Pic4Review MissionReviewQuestionComponent, Adrien Pavie.
 * AGPL-3.0-or-later. Retains its choice/usertext answer contract and selection
 * state, with native controls instead of the retired Material UI beta. */
import React, { Component } from 'react';
export default class Question extends Component {
  state={selectedAnswer:-1};
  _onAnswerChange(key) {
    this.setState({selectedAnswer:key});
    this.props.onAnswerChange(this.props.data.answers[key]);
  }
  render() {
    const {question,answers}=this.props.data;
    return <fieldset className="question"><legend>{question}</legend>{answers.map((answer,i)=><label key={answer.label} className={this.state.selectedAnswer===i?'chosen':''}>
      <input type="radio" name="review-answer" checked={this.state.selectedAnswer===i} onChange={()=>this._onAnswerChange(i)}/>{answer.label}
    </label>)}</fieldset>;
  }
}
